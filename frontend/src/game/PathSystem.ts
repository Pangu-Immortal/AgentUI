/**
 * A* 寻路系统 - PathSystem.ts
 *
 * 基于 32x32 网格的简化 A* 寻路算法，用于 Agent 在办公室中的路径规划：
 * - 网格大小：TILE_SIZE (32px)
 * - 支持标记墙壁、桌子为不可通行
 * - 支持 8 方向移动（含对角线）
 * - 返回世界坐标的 waypoint 数组
 *
 * 函数列表：
 *   constructor() - 初始化寻路系统，设置可通行网格
 *   setGrid() - 设置/更新可通行网格数据
 *   findPath() - A* 寻路，返回 waypoint 数组（世界坐标）
 *   isWalkable() - 判断某个网格坐标是否可通行
 *   worldToGrid() - 世界坐标转网格坐标
 *   gridToWorld() - 网格坐标转世界坐标（格子中心）
 */
import { TILE_SIZE } from './TileConfig'

/** 路径点（世界坐标） */
export interface Waypoint {
  x: number   // 世界坐标 X
  y: number   // 世界坐标 Y
}

/** 网格节点（内部使用） */
interface PathNode {
  col: number   // 网格列
  row: number   // 网格行
  g: number     // 从起点到当前节点的实际代价
  h: number     // 从当前节点到终点的启发式估计代价
  f: number     // g + h
  parent: PathNode | null // 父节点（用于回溯路径）
}

/** 8 方向偏移量（含对角线） */
const DIRECTIONS = [
  { dc: 0, dr: -1, cost: 1 },      // 上
  { dc: 0, dr: 1, cost: 1 },       // 下
  { dc: -1, dr: 0, cost: 1 },      // 左
  { dc: 1, dr: 0, cost: 1 },       // 右
  { dc: -1, dr: -1, cost: 1.41 },  // 左上（对角线代价 sqrt(2)）
  { dc: 1, dr: -1, cost: 1.41 },   // 右上
  { dc: -1, dr: 1, cost: 1.41 },   // 左下
  { dc: 1, dr: 1, cost: 1.41 },    // 右下
]

/** 最大搜索节点数（防止无限循环） */
const MAX_SEARCH_NODES = 5000

export class PathSystem {
  private grid: boolean[][] = []    // 可通行网格（true=可通行）
  private cols = 0                  // 网格列数
  private rows = 0                  // 网格行数

  /**
   * 构造寻路系统
   * @param grid 可通行网格（可选，后续可通过 setGrid 设置）
   */
  constructor(grid?: boolean[][]) {
    if (grid) this.setGrid(grid)                                          // 初始化网格
  }

  /**
   * 设置/更新可通行网格数据
   * @param grid 二维布尔数组，true 表示可通行
   */
  setGrid(grid: boolean[][]): void {
    this.grid = grid                                                      // 缓存网格数据
    this.rows = grid.length                                               // 更新行数
    this.cols = grid[0]?.length ?? 0                                      // 更新列数
    console.log(`[PathSystem] 网格已设置 ${this.cols}x${this.rows}`)
  }

  /**
   * A* 寻路算法
   * @param startX 起点世界坐标 X
   * @param startY 起点世界坐标 Y
   * @param endX 终点世界坐标 X
   * @param endY 终点世界坐标 Y
   * @returns waypoint 数组（世界坐标），空数组表示无法到达
   */
  findPath(startX: number, startY: number, endX: number, endY: number): Waypoint[] {
    // 转换为网格坐标
    const start = this.worldToGrid(startX, startY)                        // 起点网格坐标
    const end = this.worldToGrid(endX, endY)                              // 终点网格坐标

    // 边界检查
    if (!this.isInBounds(start.col, start.row) || !this.isInBounds(end.col, end.row)) {
      console.warn(`[PathSystem] 起点或终点超出网格范围`)
      return [{ x: endX, y: endY }]                                      // 直接返回终点
    }

    // 如果终点不可通行，寻找最近的可通行点
    let targetCol = end.col                                               // 目标列
    let targetRow = end.row                                               // 目标行
    if (!this.isWalkable(targetCol, targetRow)) {
      const nearest = this.findNearestWalkable(targetCol, targetRow)      // 寻找最近可通行点
      if (!nearest) {
        console.warn(`[PathSystem] 终点附近无可通行格子`)
        return [{ x: endX, y: endY }]                                    // 直接返回终点
      }
      targetCol = nearest.col
      targetRow = nearest.row
    }

    // 如果起点不可通行，寻找最近的可通行点
    let srcCol = start.col
    let srcRow = start.row
    if (!this.isWalkable(srcCol, srcRow)) {
      const nearest = this.findNearestWalkable(srcCol, srcRow)
      if (!nearest) return [{ x: endX, y: endY }]
      srcCol = nearest.col
      srcRow = nearest.row
    }

    // 起点和终点相同
    if (srcCol === targetCol && srcRow === targetRow) {
      return [this.gridToWorld(targetCol, targetRow)]
    }

    // ── A* 核心算法 ──
    const openList: PathNode[] = []                                       // 开放列表（待探索）
    const closedSet = new Set<string>()                                   // 关闭集合（已探索）

    // 创建起始节点
    const startNode: PathNode = {
      col: srcCol,
      row: srcRow,
      g: 0,
      h: this.heuristic(srcCol, srcRow, targetCol, targetRow),
      f: 0,
      parent: null,
    }
    startNode.f = startNode.g + startNode.h                               // 计算 f 值
    openList.push(startNode)                                              // 加入开放列表

    let searchCount = 0                                                   // 搜索计数器

    while (openList.length > 0 && searchCount < MAX_SEARCH_NODES) {
      searchCount++

      // 找到 f 值最小的节点
      let bestIdx = 0                                                     // 最佳节点索引
      for (let i = 1; i < openList.length; i++) {
        if (openList[i]!.f < openList[bestIdx]!.f) bestIdx = i           // 更新最佳
      }
      const current = openList.splice(bestIdx, 1)[0]!                    // 取出最佳节点

      // 到达终点
      if (current.col === targetCol && current.row === targetRow) {
        return this.reconstructPath(current)                              // 回溯路径
      }

      const key = `${current.col},${current.row}`                        // 节点键值
      if (closedSet.has(key)) continue                                    // 已探索过则跳过
      closedSet.add(key)                                                  // 标记已探索

      // 探索 8 个方向的邻居
      for (const dir of DIRECTIONS) {
        const nc = current.col + dir.dc                                   // 邻居列
        const nr = current.row + dir.dr                                   // 邻居行
        const nkey = `${nc},${nr}`

        if (!this.isInBounds(nc, nr)) continue                            // 超出边界跳过
        if (!this.isWalkable(nc, nr)) continue                            // 不可通行跳过
        if (closedSet.has(nkey)) continue                                 // 已探索跳过

        // 对角线移动检查：确保不会穿墙角
        if (dir.dc !== 0 && dir.dr !== 0) {
          if (!this.isWalkable(current.col + dir.dc, current.row) ||      // 水平方向不可通行
              !this.isWalkable(current.col, current.row + dir.dr)) {      // 垂直方向不可通行
            continue                                                      // 不能穿墙角
          }
        }

        const g = current.g + dir.cost                                    // 新 g 值
        const h = this.heuristic(nc, nr, targetCol, targetRow)            // 启发式估计
        const f = g + h                                                   // f 值

        // 检查是否已在开放列表中且有更优路径
        const existing = openList.find(n => n.col === nc && n.row === nr) // 查找已有节点
        if (existing && existing.f <= f) continue                         // 已有更优路径则跳过

        // 添加到开放列表
        openList.push({
          col: nc,
          row: nr,
          g,
          h,
          f,
          parent: current,
        })
      }
    }

    // 未找到路径，直接返回终点
    console.warn(`[PathSystem] 未找到路径 (${srcCol},${srcRow})->(${targetCol},${targetRow}) 搜索了 ${searchCount} 个节点`)
    return [{ x: endX, y: endY }]
  }

  /**
   * 判断网格坐标是否可通行
   * @param col 列号
   * @param row 行号
   * @returns 是否可通行
   */
  isWalkable(col: number, row: number): boolean {
    if (!this.isInBounds(col, row)) return false                          // 越界不可通行
    return this.grid[row]?.[col] === true                                 // 查询网格数据
  }

  /**
   * 世界坐标转网格坐标
   * @param x 世界 X
   * @param y 世界 Y
   * @returns 网格坐标 {col, row}
   */
  worldToGrid(x: number, y: number): { col: number; row: number } {
    return {
      col: Math.floor(x / TILE_SIZE),                                     // 列号 = X / 格子大小
      row: Math.floor(y / TILE_SIZE),                                     // 行号 = Y / 格子大小
    }
  }

  /**
   * 网格坐标转世界坐标（返回格子中心点）
   * @param col 列号
   * @param row 行号
   * @returns 世界坐标 {x, y}
   */
  gridToWorld(col: number, row: number): Waypoint {
    return {
      x: col * TILE_SIZE + TILE_SIZE / 2,                                 // 格子中心 X
      y: row * TILE_SIZE + TILE_SIZE / 2,                                 // 格子中心 Y
    }
  }

  /**
   * 判断网格坐标是否在边界内
   * @param col 列号
   * @param row 行号
   */
  private isInBounds(col: number, row: number): boolean {
    return col >= 0 && col < this.cols && row >= 0 && row < this.rows     // 范围检查
  }

  /**
   * 启发式函数（切比雪夫距离，适合 8 方向移动）
   * @param c1 起点列
   * @param r1 起点行
   * @param c2 终点列
   * @param r2 终点行
   */
  private heuristic(c1: number, r1: number, c2: number, r2: number): number {
    const dx = Math.abs(c1 - c2)                                          // 列距离
    const dy = Math.abs(r1 - r2)                                          // 行距离
    return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy)        // 切比雪夫距离变体
  }

  /**
   * 回溯路径（从终点到起点，再反转）
   * @param endNode 终点节点
   * @returns 世界坐标 waypoint 数组
   */
  private reconstructPath(endNode: PathNode): Waypoint[] {
    const path: Waypoint[] = []
    let node: PathNode | null = endNode                                   // 从终点开始

    while (node) {
      path.push(this.gridToWorld(node.col, node.row))                     // 转换为世界坐标
      node = node.parent                                                  // 回溯到父节点
    }

    path.reverse()                                                        // 反转为起点到终点

    // 路径简化：移除共线中间点（减少 waypoint 数量）
    return this.simplifyPath(path)
  }

  /**
   * 简化路径：移除方向相同的连续中间点
   * @param path 原始路径
   * @returns 简化后的路径
   */
  private simplifyPath(path: Waypoint[]): Waypoint[] {
    if (path.length <= 2) return path                                     // 2 个点以下无需简化

    const simplified: Waypoint[] = [path[0]!]                             // 保留起点
    let prevDx = 0                                                        // 前一段方向 X
    let prevDy = 0                                                        // 前一段方向 Y

    for (let i = 1; i < path.length; i++) {
      const dx = path[i]!.x - path[i - 1]!.x                            // 当前段方向 X
      const dy = path[i]!.y - path[i - 1]!.y                            // 当前段方向 Y

      // 方向改变时保留拐点
      if (dx !== prevDx || dy !== prevDy) {
        // 保留上一个点作为拐点（如果不是起点）
        if (i > 1) simplified.push(path[i - 1]!)
        prevDx = dx                                                       // 更新方向
        prevDy = dy
      }
    }

    simplified.push(path[path.length - 1]!)                               // 保留终点
    return simplified
  }

  /**
   * 寻找最近的可通行格子（BFS 搜索）
   * @param col 起始列
   * @param row 起始行
   * @returns 最近的可通行格子坐标，null 表示找不到
   */
  private findNearestWalkable(col: number, row: number): { col: number; row: number } | null {
    const visited = new Set<string>()                                     // 已访问集合
    const queue: { col: number; row: number }[] = [{ col, row }]          // BFS 队列
    visited.add(`${col},${row}`)

    while (queue.length > 0) {
      const current = queue.shift()!                                      // 取出队首
      if (this.isWalkable(current.col, current.row)) return current       // 找到可通行格子

      // 向 4 个方向扩展
      for (const dir of [{ dc: 0, dr: -1 }, { dc: 0, dr: 1 }, { dc: -1, dr: 0 }, { dc: 1, dr: 0 }]) {
        const nc = current.col + dir.dc                                   // 邻居列
        const nr = current.row + dir.dr                                   // 邻居行
        const key = `${nc},${nr}`
        if (!visited.has(key) && this.isInBounds(nc, nr)) {
          visited.add(key)
          queue.push({ col: nc, row: nr })
        }
      }

      if (visited.size > 200) break                                       // 防止搜索过大范围
    }

    return null                                                           // 未找到
  }
}
