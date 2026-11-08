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
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * 硬件计步器管理器（Issue #57）：
 * - 监听 Sensor.TYPE_STEP_COUNTER（从开机起累计的步数传感器）；
 * - 以打卡日（YYYY-MM-DD）为单位在本地 SharedPreferences 保存当日基准值，实时计算今日步数；
 * - 若设备无计步传感器或未授予 ACTIVITY_RECOGNITION 权限，安全返回 0，绝不抛出异常。
 */
class StepCounterManager(private val context: Context) : SensorEventListener {

    private val prefs: SharedPreferences =
        context.getSharedPreferences("daydayon_steps", Context.MODE_PRIVATE)
    private val sensorManager: SensorManager? =
        context.getSystemService(Context.SENSOR_SERVICE) as? SensorManager
    private val stepSensor: Sensor? =
        sensorManager?.getDefaultSensor(Sensor.TYPE_STEP_COUNTER)
    private var registered = false

    fun hasStepPermission(): Boolean {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return true
        return context.checkSelfPermission(Manifest.permission.ACTIVITY_RECOGNITION) ==
            PackageManager.PERMISSION_GRANTED
    }

    fun startListening() {
        if (registered || stepSensor == null || !hasStepPermission()) return
        try {
            sensorManager?.registerListener(this, stepSensor, SensorManager.SENSOR_DELAY_UI)
            registered = true
        } catch (_: Throwable) {
            registered = false
        }
    }

    fun stopListening() {
        if (!registered) return
        try {
            sensorManager?.unregisterListener(this)
        } catch (_: Throwable) {
            // ignore
        } finally {
            registered = false
        }
    }

    override fun onSensorChanged(event: SensorEvent?) {
        if (event == null || event.values.isEmpty()) return
        val totalSinceBoot = event.values[0].toInt()
        if (totalSinceBoot < 0) return

        val today = currentLocalDate()
        val savedDate = prefs.getString("baseline_date", null)
        var baseline = prefs.getInt("baseline_steps", totalSinceBoot)

        // 换日或手机重启（totalSinceBoot < baseline）时重置基准值
        if (savedDate != today || totalSinceBoot < baseline) {
            baseline = totalSinceBoot
            prefs.edit()
                .putString("baseline_date", today)
                .putInt("baseline_steps", baseline)
                .putInt("today_steps", 0)
                .apply()
            return
        }

        val todaySteps = (totalSinceBoot - baseline).coerceIn(0, 200_000)
        prefs.edit().putInt("today_steps", todaySteps).apply()
    }

    override fun onAccuracyChanged(sensor: Sensor?, accuracy: Int) {
        // 无需处理
    }

    fun getTodaySteps(): Int {
        if (!hasStepPermission()) return 0
        startListening()
        val today = currentLocalDate()
        val savedDate = prefs.getString("baseline_date", null)
        if (savedDate != today) return 0
        return prefs.getInt("today_steps", 0).coerceIn(0, 200_000)
    }

    private fun currentLocalDate(): String {
        val fmt = SimpleDateFormat("yyyy-MM-dd", Locale.US)
        return fmt.format(Date())
    }
}
