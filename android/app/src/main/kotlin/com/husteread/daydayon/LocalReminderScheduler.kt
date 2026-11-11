package com.husteread.daydayon

import android.Manifest
import android.app.AlarmManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import java.util.Calendar

/**
 * 手机端打卡提醒与通知推送调度器（Issue #57 / #80）：
 * - 当用户在「我的 → 打卡与提醒」中选择「手机提醒」时，检测系统通知权限并注册精确唤醒闹钟；
 * - 使用单次精确闹钟（setExactAndAllowWhileIdle / setAndAllowWhileIdle）并在触发后自动续期次日闹钟，
 *   避免 setRepeating 在 Android 8+ Doze 模式下被系统合并延迟或静默丢弃；
 * - 使用独立纯白矢量状态栏小图标（ic_stat_reminder）与高优通知渠道，确保状态栏横幅正常弹出。
 */
object LocalReminderScheduler {

    const val ACTION_DAILY_REMINDER = "com.husteread.daydayon.ACTION_DAILY_REMINDER"
    const val CHANNEL_ID = "daydayon_checkin_reminder_v2"
    private const val PREFS_NAME = "daydayon_reminder"
    private const val REQUEST_CODE = 23329
    const val REMINDER_NOTIFICATION_ID = 23329
    const val TEST_NOTIFICATION_ID = 23330

    fun areNotificationsPermitted(context: Context): Boolean {
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            ?: return false
        if (!nm.areNotificationsEnabled()) return false
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            return context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) ==
                PackageManager.PERMISSION_GRANTED
        }
        return true
    }

    fun ensureChannel(context: Context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            ?: return
        val channel = NotificationChannel(
            CHANNEL_ID,
            "每日打卡提醒",
            NotificationManager.IMPORTANCE_HIGH,
        ).apply {
            description = "按设定时间推送每日打卡提醒通知"
            enableVibration(true)
            lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        }
        manager.createNotificationChannel(channel)
    }

    fun scheduleDailyReminder(context: Context, remindAt: String, enabled: Boolean): Boolean {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit()
            .putString("remind_at", remindAt)
            .putBoolean("enabled", enabled)
            .apply()

        ensureChannel(context)

        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
            ?: return false
        val pendingIntent = buildPendingIntent(context)

        if (!enabled) {
            alarmManager.cancel(pendingIntent)
            return true
        }

        if (!areNotificationsPermitted(context)) {
            alarmManager.cancel(pendingIntent)
            return false
        }

        val parts = remindAt.split(":")
        val hour = parts.getOrNull(0)?.toIntOrNull()?.coerceIn(0, 23) ?: 21
        val minute = parts.getOrNull(1)?.toIntOrNull()?.coerceIn(0, 59) ?: 0

        val now = Calendar.getInstance()
        val target = Calendar.getInstance().apply {
            set(Calendar.HOUR_OF_DAY, hour)
            set(Calendar.MINUTE, minute)
            set(Calendar.SECOND, 0)
            set(Calendar.MILLISECOND, 0)
            if (!after(now)) {
                add(Calendar.DAY_OF_YEAR, 1)
            }
        }

        return scheduleSingleWakeup(alarmManager, target.timeInMillis, pendingIntent)
    }

    private fun scheduleSingleWakeup(
        alarmManager: AlarmManager,
        triggerAtMillis: Long,
        pendingIntent: PendingIntent,
    ): Boolean {
        val canExact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S ||
            runCatching { alarmManager.canScheduleExactAlarms() }.getOrDefault(false)

        if (canExact) {
            try {
                alarmManager.setExactAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP,
                    triggerAtMillis,
                    pendingIntent,
                )
                return true
            } catch (_: SecurityException) {
                // 部分 ROM 未授予精确闹钟时自动回退至 Doze 兼容的唤醒闹钟
            } catch (_: Throwable) {
                return false
            }
        }

        return try {
            alarmManager.setAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP,
                triggerAtMillis,
                pendingIntent,
            )
            true
        } catch (_: Throwable) {
            false
        }
    }

    fun rescheduleIfEnabled(context: Context) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val enabled = prefs.getBoolean("enabled", false)
        val remindAt = prefs.getString("remind_at", "21:00") ?: "21:00"
        if (enabled) {
            scheduleDailyReminder(context, remindAt, true)
        }
    }

    fun postReminderNotification(
        context: Context,
        title: String,
        body: String,
        notificationId: Int = REMINDER_NOTIFICATION_ID,
    ): Boolean {
        if (!areNotificationsPermitted(context)) return false
        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            ?: return false
        ensureChannel(context)

        val launchIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val contentIntent = PendingIntent.getActivity(
            context,
            notificationId,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            Notification.Builder(context, CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            Notification.Builder(context).setPriority(Notification.PRIORITY_HIGH)
        }

        val notification = builder
            .setSmallIcon(R.drawable.ic_stat_reminder)
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(Notification.BigTextStyle().bigText(body))
            .setCategory(Notification.CATEGORY_REMINDER)
            .setVisibility(Notification.VISIBILITY_PUBLIC)
            .setContentIntent(contentIntent)
            .setAutoCancel(true)
            .build()

        return try {
            manager.notify(notificationId, notification)
            true
        } catch (_: Throwable) {
            false
        }
    }

    private fun buildPendingIntent(context: Context): PendingIntent {
        val intent = Intent(context, ReminderReceiver::class.java).apply {
            action = ACTION_DAILY_REMINDER
        }
        val flags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        return PendingIntent.getBroadcast(context, REQUEST_CODE, intent, flags)
    }
}

class ReminderReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent?) {
        val action = intent?.action ?: return
        when (action) {
            Intent.ACTION_BOOT_COMPLETED,
            Intent.ACTION_MY_PACKAGE_REPLACED,
            Intent.ACTION_TIME_CHANGED,
            Intent.ACTION_TIMEZONE_CHANGED,
            -> {
                LocalReminderScheduler.rescheduleIfEnabled(context)
            }
            LocalReminderScheduler.ACTION_DAILY_REMINDER -> {
                LocalReminderScheduler.rescheduleIfEnabled(context)
                LocalReminderScheduler.postReminderNotification(
                    context = context,
                    title = "团团提醒你打卡啦～",
                    body = "今天的小目标记好了吗？点开 DayDayOn 打个卡吧！",
                    notificationId = LocalReminderScheduler.REMINDER_NOTIFICATION_ID,
                )
            }
        }
    }
}
