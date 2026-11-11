package com.husteread.daydayon

import android.Manifest
import android.content.Context
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.hardware.Sensor
import android.hardware.SensorEvent
import android.hardware.SensorEventListener
import android.hardware.SensorManager
import android.os.Build
import android.os.Handler
import android.os.HandlerThread
import android.os.SystemClock
import java.text.SimpleDateFormat
import java.util.Calendar
import java.util.Date
import java.util.Locale
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit

/**
 * 硬件计步器管理器（Issue #57 · Issue #80）：
 * - 独立传感器线程监听 Sensor.TYPE_STEP_COUNTER + Sensor.TYPE_STEP_DETECTOR，避免首次授权读取为 0 的主线程竞态；
 * - 智能计算当日零点与设备开机时间：若设备在今日零点后开机，开机以来的步数直接计入今日（无需丢弃归零）；
 * - 支持同日手机重启续接（carried_steps）：当检测到 totalSinceBoot < lastSensorValue 时保留重启前已累计步数；
 * - 若设备无计步传感器或未授予 ACTIVITY_RECOGNITION 权限，安全返回本地已存今日步数或 0，绝不抛出异常。
 */
class StepCounterManager(private val context: Context) : SensorEventListener {

    private val prefs: SharedPreferences =
        context.getSharedPreferences("daydayon_steps", Context.MODE_PRIVATE)
    private val sensorManager: SensorManager? =
        context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
    private val stepCounterSensor: Sensor? =
        sensorManager?.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
    private val stepDetectorSensor: Sensor? =
        sensorManager?.getDefaultSensor(Sensor.TYPE_STEP_DETECTOR)

    @Volatile
    private var registered = false
    private var sensorThread: HandlerThread? = null
    private var sensorHandler: Handler? = null

    @Volatile
    private var hasFreshCounterSample = false

    @Volatile
    private var sampleLatch: CountDownLatch? = null

    fun hasStepPermission(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return true
        return context.checkSelfPermission(Manifest.permission.ACTIVITY_RECOGNITION) ==
            PackageManager.PERMISSION_GRANTED
    }

    @Synchronized
    private fun ensureSensorHandler(): Handler {
        val existing = sensorHandler
        if (existing != null && sensorThread?.isAlive == true) return existing
        val thread = HandlerThread("ddo-step-sensor").apply { start() }
        val handler = Handler(thread.looper)
        sensorThread = thread
        sensorHandler = handler
        return handler
    }

    @Synchronized
    fun startListening() {
        if (registered || !hasStepPermission()) return
        if (stepCounterSensor == null && stepDetectorSensor == null) return
        try {
            val handler = ensureSensorHandler()
            if (stepCounterSensor != null) {
                sampleLatch = CountDownLatch(1)
                sensorManager?.registerListener(
                    this,
                    stepCounterSensor,
                    SensorManager.SENSOR_DELAY_FASTEST,
                    handler,
                )
            }
            if (stepDetectorSensor != null) {
                sensorManager?.registerListener(
                    this,
                    stepDetectorSensor,
                    SensorManager.SENSOR_DELAY_UI,
                    handler,
                )
            }
            registered = true
        } catch (_: Throwable) {
            registered = false
        }
    }

    @Synchronized
    fun stopListening() {
        if (!registered) return
        try {
            sensorManager?.unregisterListener(this)
        } catch (_: Throwable) {
            // ignore
        } finally {
            registered = false
            hasFreshCounterSample = false
            sampleLatch?.countDown()
            sampleLatch = null
            try {
                sensorThread?.quitSafely()
            } catch (_: Throwable) {
                // ignore
            }
            sensorThread = null
            sensorHandler = null
        }
    }

    override fun onSensorChanged(event: SensorEvent?) {
        if (event == null || event.values.isEmpty()) return
        when (event.sensor?.type) {
            Sensor.TYPE_STEP_COUNTER -> {
                val totalSinceBoot = event.values[0].toInt()
                if (totalSinceBoot >= 0) {
                    processStepCounterSample(totalSinceBoot)
                    hasFreshCounterSample = true
                    sampleLatch?.countDown()
                }
            }
            Sensor.TYPE_STEP_DETECTOR -> {
                // 当设备仅支持单步检测或硬件计数器尚未推送最新批次时，做实时增量兜底
                val delta = event.values[0].toInt().coerceAtLeast(0)
                if (delta > 0 && stepCounterSensor == null) {
                    incrementDetectorOnlySteps(delta)
                }
            }
        }
    }

    @Synchronized
    private fun processStepCounterSample(totalSinceBoot: Int) {
        val today = currentLocalDate()
        val savedDate = prefs.getString("baseline_date", null)

        if (savedDate != today) {
            // 新的一天（或首次安装打开）：
            // 若手机是在今天 00:00 之后才开机的，开机以来的全部步数都属于今天，基准值应为 0！
            val bootEpochMs = System.currentTimeMillis() - SystemClock.elapsedRealtime()
            val todayStartMs = startOfTodayMillis()
            val newBaseline = if (bootEpochMs >= todayStartMs) 0 else totalSinceBoot
            val initialTodaySteps = (totalSinceBoot - newBaseline).coerceIn(0, 200_000)

            prefs.edit()
                .putString("baseline_date", today)
                .putInt("baseline_steps", newBaseline)
                .putInt("carried_steps", 0)
                .putInt("last_sensor_steps", totalSinceBoot)
                .putInt("today_steps", initialTodaySteps)
                .apply()
            return
        }

        val lastSensor = prefs.getInt("last_sensor_steps", totalSinceBoot)
        var baseline = prefs.getInt("baseline_steps", totalSinceBoot)
        var carried = prefs.getInt("carried_steps", 0)

        if (totalSinceBoot < lastSensor || totalSinceBoot < baseline) {
            // 同日内设备发生过重启：保留重启前已累计的今日步数，并以 0 作为重启后新基准
            carried = prefs.getInt("today_steps", 0).coerceIn(0, 200_000)
            baseline = 0
        }

        val todaySteps = (carried + (totalSinceBoot - baseline).coerceAtLeast(0)).coerceIn(0, 200_000)
        prefs.edit()
            .putInt("baseline_steps", baseline)
            .putInt("carried_steps", carried)
            .putInt("last_sensor_steps", totalSinceBoot)
            .putInt("today_steps", todaySteps)
            .apply()
    }

    @Synchronized
    private fun incrementDetectorOnlySteps(delta: Int) {
        val today = currentLocalDate()
        val savedDate = prefs.getString("baseline_date", null)
        val base = if (savedDate == today) prefs.getInt("today_steps", 0) else 0
        val next = (base + delta).coerceIn(0, 200_000)
        prefs.edit()
            .putString("baseline_date", today)
            .putInt("today_steps", next)
            .apply()
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {
        // 无需处理
    }

    fun getTodaySteps(): Int {
        if (!hasStepPermission()) return 0
        startListening()

        // 触发硬件传感器批处理刷新；若刚注册监听器尚未收到首帧粘性事件，最多等待 450ms（不阻塞主线程传感器回调）
        try {
            sensorManager?.flush(this)
        } catch (_: Throwable) {
            // ignore
        }

        if (!hasFreshCounterSample && stepCounterSensor != null) {
            val latch = sampleLatch
            if (latch != null) {
                try {
                    latch.await(450L, TimeUnit.MILLISECONDS)
                } catch (_: InterruptedException) {
                    Thread.currentThread().interrupt()
                }
            }
        }

        val today = currentLocalDate()
        val savedDate = prefs.getString("baseline_date", null)
        if (savedDate != today) return 0
        return prefs.getInt("today_steps", 0).coerceIn(0, 200_000)
    }

    private fun startOfTodayMillis(): Long {
        val cal = Calendar.getInstance()
        cal.set(Calendar.HOUR_OF_DAY, 0)
        cal.set(Calendar.MINUTE, 0)
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)
        return cal.timeInMillis
    }

    private fun currentLocalDate(): String {
        val fmt = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        return fmt.format(Date())
    }
}
