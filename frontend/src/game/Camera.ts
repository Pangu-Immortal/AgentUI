/**
 * 摄像机/视口控制器 - Camera.ts
 *
 * 管理 PixiJS Container 作为世界容器，提供以下功能：
 * - enableDrag(): 启用鼠标/触摸拖拽平移
 * - centerOn(): 将视口中心对准指定坐标
 * - resize(): 响应屏幕尺寸变化
 * - destroy(): 清理所有事件监听
 *
 * 支持滚轮缩放（0.3x ~ 3x）和触摸屏双指缩放
 * 包含边界限制，防止拖出地图范围
 */
import { Container } from 'pixi.js'

export class Camera {
  container: Container                  // 世界容器，所有游戏对象放在这里面

  private screenWidth: number           // 屏幕宽度（像素）
  private screenHeight: number          // 屏幕高度（像素）
  private mapWidth: number              // 地图宽度（像素）
  private mapHeight: number             // 地图高度（像素）

  private isDragging = false            // 是否正在拖拽中
  private lastX = 0                     // 上一次指针 X 坐标
  private lastY = 0                     // 上一次指针 Y 坐标
  private scale = 1                     // 当前缩放比例
  private readonly minScale = 0.3       // 最小缩放倍率
  private readonly maxScale = 3.0       // 最大缩放倍率

  // 触摸屏双指缩放相关
  private lastPinchDist = 0             // 上一次双指距离
  private isPinching = false            // 是否正在双指缩放

  // 存储事件回调引用，用于 destroy 时移除
  private _onPointerDown: ((e: PointerEvent) => void) | null = null   // 指针按下回调
  private _onPointerMove: ((e: PointerEvent) => void) | null = null   // 指针移动回调
  private _onPointerUp: ((e: PointerEvent) => void) | null = null     // 指针抬起回调
  private _onWheel: ((e: WheelEvent) => void) | null = null           // 滚轮回调
  private _onTouchStart: ((e: TouchEvent) => void) | null = null      // 触摸开始回调
  private _onTouchMove: ((e: TouchEvent) => void) | null = null       // 触摸移动回调
  private _onTouchEnd: ((e: TouchEvent) => void) | null = null        // 触摸结束回调
  private _canvas: HTMLCanvasElement | null = null                     // 画布引用

  /**
   * 构造摄像机控制器
   * @param screenWidth 屏幕宽度
   * @param screenHeight 屏幕高度
   * @param mapWidth 地图宽度
   * @param mapHeight 地图高度
   */
  constructor(screenWidth: number, screenHeight: number, mapWidth: number, mapHeight: number) {
    this.screenWidth = screenWidth       // 缓存屏幕宽度
    this.screenHeight = screenHeight     // 缓存屏幕高度
    this.mapWidth = mapWidth             // 缓存地图宽度
    this.mapHeight = mapHeight           // 缓存地图高度
    this.container = new Container()     // 创建世界容器
    this.container.label = 'camera-world' // 设置容器标签方便调试
    console.log(`[Camera] 初始化完成 screen=${screenWidth}x${screenHeight} map=${mapWidth}x${mapHeight}`)
  }

  /**
   * 绑定鼠标/触摸拖拽和缩放事件
   * @param canvas 画布 DOM 元素
   */
  enableDrag(canvas: HTMLCanvasElement): void {
    this._canvas = canvas // 保存画布引用

    // === 鼠标/指针拖拽 ===
    this._onPointerDown = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return // 触摸事件由 touch 处理器处理
      this.isDragging = true               // 标记拖拽开始
      this.lastX = e.clientX               // 记录起始 X
      this.lastY = e.clientY               // 记录起始 Y
    }

    this._onPointerMove = (e: PointerEvent) => {
      if (!this.isDragging) return          // 未拖拽则跳过
      if (e.pointerType === 'touch') return // 触摸事件由 touch 处理器处理
      const dx = e.clientX - this.lastX    // 计算水平偏移
      const dy = e.clientY - this.lastY    // 计算垂直偏移
      this.container.x += dx              // 更新容器水平位置
      this.container.y += dy              // 更新容器垂直位置
      this.lastX = e.clientX              // 更新上一次 X
      this.lastY = e.clientY              // 更新上一次 Y
      this.clampPosition()                // 限制边界
    }

    this._onPointerUp = () => {
      this.isDragging = false              // 标记拖拽结束
    }

    // === 滚轮缩放 ===
    this._onWheel = (e: WheelEvent) => {
      e.preventDefault()                   // 阻止页面滚动
      const delta = e.deltaY > 0 ? -0.1 : 0.1 // 判断滚轮方向
      const oldScale = this.scale          // 保存旧缩放值

      // 计算新缩放值并限制范围
      this.scale = Math.max(this.minScale, Math.min(this.maxScale, this.scale + delta))

      // 以鼠标位置为中心进行缩放
      const rect = canvas.getBoundingClientRect() // 获取画布位置
      const mouseX = e.clientX - rect.left // 鼠标相对画布 X
      const mouseY = e.clientY - rect.top  // 鼠标相对画布 Y

      // 计算缩放比例变化
      const scaleRatio = this.scale / oldScale

      // 调整容器位置，使缩放以鼠标为中心
      this.container.x = mouseX - (mouseX - this.container.x) * scaleRatio
      this.container.y = mouseY - (mouseY - this.container.y) * scaleRatio

      this.container.scale.set(this.scale) // 应用新缩放
      this.clampPosition()                // 限制边界
    }

    // === 触摸屏双指缩放和拖拽 ===
    this._onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        // 单指拖拽
        this.isDragging = true             // 开始拖拽
        this.lastX = e.touches[0].clientX  // 记录触摸起始 X
        this.lastY = e.touches[0].clientY  // 记录触摸起始 Y
      } else if (e.touches.length === 2) {
        // 双指缩放
        this.isDragging = false            // 停止拖拽
        this.isPinching = true             // 开始双指缩放
        this.lastPinchDist = this.getTouchDistance(e.touches) // 记录初始双指距离
      }
    }

    this._onTouchMove = (e: TouchEvent) => {
      e.preventDefault()                   // 阻止页面滚动

      if (e.touches.length === 1 && this.isDragging) {
        // 单指拖拽
        const dx = e.touches[0].clientX - this.lastX // 水平偏移
        const dy = e.touches[0].clientY - this.lastY // 垂直偏移
        this.container.x += dx            // 更新容器 X
        this.container.y += dy            // 更新容器 Y
        this.lastX = e.touches[0].clientX // 更新上一次 X
        this.lastY = e.touches[0].clientY // 更新上一次 Y
        this.clampPosition()              // 限制边界
      } else if (e.touches.length === 2 && this.isPinching) {
        // 双指缩放
        const dist = this.getTouchDistance(e.touches) // 当前双指距离
        const scaleDelta = dist / this.lastPinchDist  // 缩放比例
        const oldScale = this.scale        // 保存旧缩放

        // 计算新缩放值并限制范围
        this.scale = Math.max(this.minScale, Math.min(this.maxScale, this.scale * scaleDelta))

        // 以双指中心为缩放中心
        const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2 // 中心 X
        const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2 // 中心 Y
        const rect = canvas.getBoundingClientRect() // 画布位置
        const localX = centerX - rect.left // 相对画布 X
        const localY = centerY - rect.top  // 相对画布 Y
        const scaleRatio = this.scale / oldScale // 缩放比率

        // 调整容器位置
        this.container.x = localX - (localX - this.container.x) * scaleRatio
        this.container.y = localY - (localY - this.container.y) * scaleRatio

        this.container.scale.set(this.scale) // 应用缩放
        this.lastPinchDist = dist          // 更新上一次双指距离
        this.clampPosition()               // 限制边界
      }
    }

    this._onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) {
        this.isPinching = false            // 结束双指缩放
      }
      if (e.touches.length === 0) {
        this.isDragging = false            // 结束拖拽
      }
    }

    // 绑定所有事件
    canvas.addEventListener('pointerdown', this._onPointerDown)   // 指针按下
    canvas.addEventListener('pointermove', this._onPointerMove)   // 指针移动
    canvas.addEventListener('pointerup', this._onPointerUp)       // 指针抬起
    canvas.addEventListener('pointerleave', this._onPointerUp)    // 指针离开画布
    canvas.addEventListener('wheel', this._onWheel, { passive: false }) // 滚轮缩放
    canvas.addEventListener('touchstart', this._onTouchStart, { passive: false }) // 触摸开始
    canvas.addEventListener('touchmove', this._onTouchMove, { passive: false })   // 触摸移动
    canvas.addEventListener('touchend', this._onTouchEnd)         // 触摸结束

    console.log('[Camera] 拖拽和缩放事件已绑定')
  }

  /** 自动缩放使整个地图适配屏幕（带边距） */
  fitToScreen(): void {
    const padX = 40                                          // 水平边距
    const padY = 40                                          // 垂直边距
    const scaleX = (this.screenWidth - padX * 2) / this.mapWidth  // 水平缩放比
    const scaleY = (this.screenHeight - padY * 2) / this.mapHeight // 垂直缩放比
    this.scale = Math.max(this.minScale, Math.min(this.maxScale, Math.min(scaleX, scaleY))) // 取较小值
    this.container.scale.set(this.scale)                     // 应用缩放
    this.centerOn(this.mapWidth / 2, this.mapHeight / 2)     // 居中显示
    console.log(`[Camera] 自动适配屏幕 scale=${this.scale.toFixed(3)}`)
  }

  /**
   * 将视口中心对准指定世界坐标
   * @param x 世界坐标 X
   * @param y 世界坐标 Y
   */
  centerOn(x: number, y: number): void {
    this.container.x = this.screenWidth / 2 - x * this.scale   // 计算容器 X 使目标居中
    this.container.y = this.screenHeight / 2 - y * this.scale   // 计算容器 Y 使目标居中
    this.clampPosition()                                         // 限制边界
    console.log(`[Camera] 居中到坐标 (${x}, ${y})`)
  }

  /**
   * 响应屏幕尺寸变化
   * @param screenWidth 新的屏幕宽度
   * @param screenHeight 新的屏幕高度
   */
  resize(screenWidth: number, screenHeight: number): void {
    this.screenWidth = screenWidth         // 更新屏幕宽度
    this.screenHeight = screenHeight       // 更新屏幕高度
    this.clampPosition()                   // 重新检查边界
    console.log(`[Camera] 视口尺寸更新 ${screenWidth}x${screenHeight}`)
  }

  /** 限制容器位置，防止拖出地图范围 */
  private clampPosition(): void {
    const scaledMapW = this.mapWidth * this.scale   // 缩放后地图宽度
    const scaledMapH = this.mapHeight * this.scale  // 缩放后地图高度

    // 如果缩放后地图小于屏幕，居中显示
    if (scaledMapW <= this.screenWidth) {
      this.container.x = (this.screenWidth - scaledMapW) / 2 // 水平居中
    } else {
      // 限制不能拖出左边界和右边界
      const minX = this.screenWidth - scaledMapW  // 左边界最小值
      const maxX = 0                               // 右边界最大值
      this.container.x = Math.max(minX, Math.min(maxX, this.container.x))
    }

    if (scaledMapH <= this.screenHeight) {
      this.container.y = (this.screenHeight - scaledMapH) / 2 // 垂直居中
    } else {
      // 限制不能拖出上边界和下边界
      const minY = this.screenHeight - scaledMapH // 上边界最小值
      const maxY = 0                               // 下边界最大值
      this.container.y = Math.max(minY, Math.min(maxY, this.container.y))
    }
  }

  /**
   * 计算两个触摸点之间的距离
   * @param touches 触摸点列表
   * @returns 两点距离
   */
  private getTouchDistance(touches: TouchList): number {
    const t0 = touches[0]!                             // 第一个触摸点（调用方已确保 length >= 2）
    const t1 = touches[1]!                             // 第二个触摸点
    const dx = t0.clientX - t1.clientX                 // 水平差值
    const dy = t0.clientY - t1.clientY                 // 垂直差值
    return Math.sqrt(dx * dx + dy * dy)                // 勾股定理计算距离
  }

  /** 销毁摄像机，清理所有事件监听 */
  destroy(): void {
    if (this._canvas) {
      // 移除所有事件监听器
      if (this._onPointerDown) this._canvas.removeEventListener('pointerdown', this._onPointerDown)
      if (this._onPointerMove) this._canvas.removeEventListener('pointermove', this._onPointerMove)
      if (this._onPointerUp) {
        this._canvas.removeEventListener('pointerup', this._onPointerUp)
        this._canvas.removeEventListener('pointerleave', this._onPointerUp)
      }
      if (this._onWheel) this._canvas.removeEventListener('wheel', this._onWheel)
      if (this._onTouchStart) this._canvas.removeEventListener('touchstart', this._onTouchStart)
      if (this._onTouchMove) this._canvas.removeEventListener('touchmove', this._onTouchMove)
      if (this._onTouchEnd) this._canvas.removeEventListener('touchend', this._onTouchEnd)
      this._canvas = null // 清除画布引用
    }
    console.log('[Camera] 已销毁，事件监听已清理')
  }
}
