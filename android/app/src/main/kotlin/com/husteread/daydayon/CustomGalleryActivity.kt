package com.husteread.daydayon

import android.app.Activity
import android.content.ContentUris
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.Typeface
import android.graphics.drawable.GradientDrawable
import android.os.Bundle
import android.provider.MediaStore
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.widget.BaseAdapter
import android.widget.Button
import android.widget.FrameLayout
import android.widget.GridView
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import org.json.JSONArray
import org.json.JSONObject
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * 微信风格自定义多选相册原生组件（Issue #57）：
 * - 默认最多选择 9 张图片（EXTRA_MAX_SELECT = 9）；
 * - 每张照片右上角带圆形选择框，按点击先后顺序显示「1、2、3…」序号，取消某张后后续序号自动重排；
 * - 顶栏右上角提供「取消选择」按钮，一键清空已选图片；
 * - 同时提供 MediaStore 查询方法供 WebView 内的 PhotoAlbumSheet 直接读取真实手机相册缩略图。
 */
class CustomGalleryActivity : Activity() {

    data class AlbumEntry(
        val id: Long,
        val name: String,
        val dateAddedMillis: Long,
        val width: Int,
        val height: Int,
    )

    private val selectedIds = mutableListOf<Long>()
    private var maxSelect: Int = DEFAULT_MAX_SELECT
    private var entries: List<AlbumEntry> = emptyList()
    private lateinit var clearButton: TextView
    private lateinit var confirmButton: Button
    private lateinit var adapter: GalleryGridAdapter

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        maxSelect = intent.getIntExtra(EXTRA_MAX_SELECT, DEFAULT_MAX_SELECT).coerceIn(1, 9)
        entries = queryEntries(this, 60)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(Color.parseColor("#FFF8F0"))
            layoutParams = ViewGroup.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            )
        }

        // 顶部栏：左返回 + 中标题 + 右「取消选择」按钮
        val header = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(16), dp(14), dp(16), dp(12))
        }
        val closeBtn = TextView(this).apply {
            text = "关闭"
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 15f)
            setTextColor(Color.parseColor("#7D6858"))
            setOnClickListener {
                setResult(RESULT_CANCELED)
                finish()
            }
        }
        val titleView = TextView(this).apply {
            text = "选择照片（最多 $maxSelect 张）"
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 17f)
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(Color.parseColor("#3A281D"))
            gravity = Gravity.CENTER
            layoutParams = LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f)
        }
        clearButton = TextView(this).apply {
            text = "取消选择"
            setTextSize(TypedValue.COMPLEX_UNIT_SP, 14f)
            setTypeface(typeface, Typeface.BOLD)
            setTextColor(Color.parseColor("#E06D3B"))
            visibility = View.INVISIBLE
            setOnClickListener {
                selectedIds.clear()
                updateSelectionUi()
            }
        }
        header.addView(closeBtn)
        header.addView(titleView)
        header.addView(clearButton)
        root.addView(header)

        // 中部 3 列相册网格
        val gridView = GridView(this).apply {
            numColumns = 3
            horizontalSpacing = dp(6)
            verticalSpacing = dp(6)
            setPadding(dp(12), dp(4), dp(12), dp(12))
            layoutParams = LinearLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                0,
                1f,
            )
        }
        adapter = GalleryGridAdapter()
        gridView.adapter = adapter
        root.addView(gridView)

        // 底部确认栏
        val footer = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL or Gravity.END
            setPadding(dp(16), dp(10), dp(16), dp(14))
            setBackgroundColor(Color.parseColor("#FFFDF9"))
        }
        confirmButton = Button(this).apply {
            text = "完成"
            isAllCaps = false
            isEnabled = false
            setOnClickListener {
                val data = Intent().apply {
                    putExtra(EXTRA_SELECTED_IDS, selectedIds.toLongArray())
                }
                setResult(RESULT_OK, data)
                finish()
            }
        }
        footer.addView(confirmButton)
        root.addView(footer)

        setContentView(root)
    }

    private fun toggleSelection(id: Long) {
        val idx = selectedIds.indexOf(id)
        if (idx >= 0) {
            selectedIds.removeAt(idx)
        } else {
            if (selectedIds.size >= maxSelect) {
                Toast.makeText(this, "最多只能选择 $maxSelect 张照片", Toast.LENGTH_SHORT).show()
                return
            }
            selectedIds.add(id)
        }
        updateSelectionUi()
    }

    private fun updateSelectionUi() {
        clearButton.visibility = if (selectedIds.isNotEmpty()) View.VISIBLE else View.INVISIBLE
        confirmButton.isEnabled = selectedIds.isNotEmpty()
        confirmButton.text = if (selectedIds.isNotEmpty()) {
            "完成 (${selectedIds.size}/$maxSelect)"
        } else {
            "完成"
        }
        adapter.notifyDataSetChanged()
    }

    private inner class GalleryGridAdapter : BaseAdapter() {
        override fun getCount(): Int = entries.size
        override fun getItem(position: Int): AlbumEntry = entries[position]
        override fun getItemId(position: Int): Long = entries[position].id

        override fun getView(position: Int, convertView: View?, parent: ViewGroup?): View {
            val entry = entries[position]
            val orderIdx = selectedIds.indexOf(entry.id)
            val isSelected = orderIdx >= 0

            val cell = FrameLayout(this@CustomGalleryActivity).apply {
                layoutParams = ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(112))
                setBackgroundColor(Color.parseColor("#F5EDE4"))
            }

            val img = ImageView(this@CustomGalleryActivity).apply {
                scaleType = ImageView.ScaleType.CENTER_CROP
                layoutParams = FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT,
                    ViewGroup.LayoutParams.MATCH_PARENT,
                )
            }
            try {
                val thumb = MediaStore.Images.Thumbnails.getThumbnail(
                    contentResolver,
                    entry.id,
                    MediaStore.Images.Thumbnails.MINI_KIND,
                    null,
                )
                if (thumb != null) {
                    img.setImageBitmap(thumb)
                }
            } catch (_: Throwable) {
                // ignore
            }
            cell.addView(img)

            // 右上角圆圈序号角标（1, 2, 3...）
            val badge = TextView(this@CustomGalleryActivity).apply {
                gravity = Gravity.CENTER
                setTextSize(TypedValue.COMPLEX_UNIT_SP, 12f)
                setTypeface(typeface, Typeface.BOLD)
                setTextColor(Color.WHITE)
                text = if (isSelected) (orderIdx + 1).toString() else ""
                background = GradientDrawable().apply {
                    shape = GradientDrawable.OVAL
                    setColor(
                        if (isSelected) Color.parseColor("#E06D3B")
                        else Color.parseColor("#55000000"),
                    )
                    setStroke(dp(2), Color.WHITE)
                }
                layoutParams = FrameLayout.LayoutParams(dp(24), dp(24)).apply {
                    gravity = Gravity.TOP or Gravity.END
                    topMargin = dp(6)
                    marginEnd = dp(6)
                }
            }
            cell.addView(badge)

            cell.setOnClickListener { toggleSelection(entry.id) }
            return cell
        }
    }

    private fun dp(value: Int): Int {
        return TypedValue.applyDimension(
            TypedValue.COMPLEX_UNIT_DIP,
            value.toFloat(),
            resources.displayMetrics,
        ).toInt()
    }

    companion object {
        const val DEFAULT_MAX_SELECT = 9
        const val EXTRA_MAX_SELECT = "extra_max_select"
        const val EXTRA_SELECTED_IDS = "extra_selected_ids"

        fun queryEntries(context: Context, limit: Int): List<AlbumEntry> {
            val result = mutableListOf<AlbumEntry>()
            val projection = arrayOf(
                MediaStore.Images.Media._ID,
                MediaStore.Images.Media.DISPLAY_NAME,
                MediaStore.Images.Media.DATE_ADDED,
                MediaStore.Images.Media.WIDTH,
                MediaStore.Images.Media.HEIGHT,
            )
            val sortOrder = "${MediaStore.Images.Media.DATE_ADDED} DESC"
            try {
                context.contentResolver.query(
                    MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                    projection,
                    null,
                    null,
                    sortOrder,
                )?.use { cursor ->
                    val idCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media._ID)
                    val nameCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DISPLAY_NAME)
                    val dateCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.DATE_ADDED)
                    val wCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.WIDTH)
                    val hCol = cursor.getColumnIndexOrThrow(MediaStore.Images.Media.HEIGHT)
                    while (cursor.moveToNext() && result.size < limit) {
                        val id = cursor.getLong(idCol)
                        val name = cursor.getString(nameCol) ?: "photo_$id.jpg"
                        val dateSec = cursor.getLong(dateCol)
                        val w = cursor.getInt(wCol)
                        val h = cursor.getInt(hCol)
                        result.add(
                            AlbumEntry(
                                id = id,
                                name = name,
                                dateAddedMillis = dateSec * 1000L,
                                width = if (w > 0) w else 1080,
                                height = if (h > 0) h else 1080,
                            ),
                        )
                    }
                }
            } catch (_: Throwable) {
                // 未授权或读取异常时安全返回空列表
            }
            return result
        }

        fun getAlbumPhotosJson(context: Context, limit: Int): String {
            val list = queryEntries(context, limit.coerceIn(1, 60))
            val arr = JSONArray()
            val iso = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'", Locale.US)
            for (entry in list) {
                val uri = ContentUris.withAppendedId(
                    MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                    entry.id,
                )
                val thumbDataUrl = NativeCameraHelper.uriToJpegDataUrl(context, uri, 360) ?: continue
                val obj = JSONObject().apply {
                    put("id", entry.id.toString())
                    put("name", entry.name)
                    put("previewUrl", thumbDataUrl)
                    put("createdAt", iso.format(Date(entry.dateAddedMillis)))
                    put("width", entry.width)
                    put("height", entry.height)
                }
                arr.put(obj)
            }
            return arr.toString()
        }

        fun readPhotoByIdDataUrl(context: Context, photoId: String): String {
            val id = photoId.toLongOrNull() ?: return ""
            val uri = ContentUris.withAppendedId(
                MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                id,
            )
            return NativeCameraHelper.uriToJpegDataUrl(context, uri, 1920) ?: ""
        }
    }
}
