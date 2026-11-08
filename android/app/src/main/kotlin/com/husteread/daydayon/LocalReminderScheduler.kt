package com.husteread.daydayon

import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import java.util.Calendar

/**
 * 手机端原生打卡提醒调度器（Issue #57）：
 * - 当用户在「我的 → 打卡提醒」中选择「手机提醒（手机端原生组件）」时，
 *   通过 AlarmManager 注册每日定时提醒；
 * - 到达设定时间（HH:mm）时，由 ReminderReceiver 发送系统通知提醒用户打卡。
 */
object LocalReminderScheduler {

    const val ACTION_DAILY_REMINDER = "com.husteread.daydayon.ACTION_DAILY_REMINDER"
    const val CHANNEL_ID = "daydayon_checkin_reminder"
    private const val PREFS_NAME = "daydayon_reminder"
    private const val REQUEST_CODE = 23329

    fun scheduleDailyReminder(context: Context, remindAt: String, enabled: Boolean): Boolean {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit()
            .putString("remind_at", remindAt)
            .putBoolean("enabled", enabled)
            .apply()

        val alarmManager = context.getSystemService(Context.ALARM_SERVICE) as? AlarmManager
            ?: return false
        val pendingIntent = buildPendingIntent(context)

        if (!enabled) {
            alarmManager.cancel(pendingIntent)
            return true
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
            if (before(now)) {
                add(Calendar.DAY_OF_YEAR, 1)
            }
        }

        return try {
            alarmManager.setRepeating(
                AlarmManager.RTC_WAKEUP,
                target.timeInMillis,
                AlarmManager.INTERVAL_DAY,
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
        if (action == Intent.ACTION_BOOT_COMPLETED) {
            LocalReminderScheduler.rescheduleIfEnabled(context)
            return
        }
        if (action != LocalReminderScheduler.ACTION_DAILY_REMINDER) return

        val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as? NotificationManager
            ?: return
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                LocalReminderScheduler.CHANNEL_ID,
                "每日打卡提醒",
                NotificationManager.IMPORTANCE_DEFAULT,
            ).apply {
                description = "DayDayOn 手机端原生定时打卡提醒"
            }
            manager.createNotificationChannel(channel)
        }

        val launchIntent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
        }
        val contentIntent = PendingIntent.getActivity(
            context,
            0,
            launchIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
        )

        val builder = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            android.app.Notification.Builder(context, LocalReminderScheduler.CHANNEL_ID)
        } else {
            @Suppress("DEPRECATION")
            android.app.Notification.Builder(context)
        }

        val notification = builder
            .setSmallIcon(R.mipmap.ic_launcher)
            .setContentTitle("团团提醒你打卡啦～")
            .setContentText("今天的小目标记好了吗？点开 DayDayOn 打个卡吧！")
            .setContentIntent(contentIntent)
            .setAutoCancel(true)
            .build()

        manager.notify(23329, notification)
    }
}
