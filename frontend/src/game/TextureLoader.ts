/**
 * 纹理加载器 - TextureLoader.ts
 *
 * 集中管理所有办公室精灵纹理的加载，从 claude-office 迁移而来。
 * 使用 PixiJS 8 的 Assets API 批量加载 PNG 精灵图片。
 *
 * 函数列表：
 *   loadAllTextures() - 批量加载所有精灵纹理
 *   getTexture() - 获取已加载的纹理
 *   isLoaded() - 检查是否已完成加载
 */
import { Assets, Texture } from 'pixi.js'

/** 纹理名称到路径的映射 */
const TEXTURE_PATHS: Record<string, string> = {
  floorTile: '/sprites/floor-tile.png',           // 地板瓦片
  bossRug: '/sprites/boss-rug.png',               // Boss 地毯
  waterCooler: '/sprites/watercooler.png',         // 饮水机
  coffeeMachine: '/sprites/coffee-machine.png',    // 咖啡机
  plant: '/sprites/plant.png',                     // 盆栽
  chair: '/sprites/chair.png',                     // 椅子
  desk: '/sprites/desk.png',                       // 办公桌
  keyboard: '/sprites/keyboard_back.png',          // 键盘
  monitor: '/sprites/monitor_back.png',            // 显示器
  phone: '/sprites/phone.png',                     // 电话
  printer: '/sprites/old-printer.png',             // 打印机
  elevatorFrame: '/sprites/elevator_frame.png',    // 电梯框架
  elevatorDoor: '/sprites/elevator_door.png',      // 电梯门
  wallOutlet: '/sprites/wall-outlet.png',          // 墙壁插座
  headset: '/sprites/headset_small.png',           // 耳机
  sunglasses: '/sprites/sunglasses.png',           // 墨镜
  coffeeMug: '/sprites/coffee-mug.png',            // 咖啡杯
  stapler: '/sprites/stapler.png',                 // 订书机
  deskLamp: '/sprites/desk-lamp.png',              // 台灯
  penHolder: '/sprites/pen-holder.png',            // 笔筒
  magic8Ball: '/sprites/magic-8-ball.png',         // 魔力8号球
  rubiksCube: '/sprites/rubiks-cube.png',          // 魔方
  rubberDuck: '/sprites/rubber-duck.png',          // 橡皮鸭
  thermos: '/sprites/thermos.png',                 // 保温杯
  employeeOfMonth: '/sprites/employee-of-month.png', // 月度最佳员工
}

/** 已加载的纹理缓存 */
const textureCache: Map<string, Texture> = new Map()

/** 是否已完成加载 */
let loaded = false

/**
 * 批量加载所有精灵纹理
 * @returns 是否加载成功
 */
export async function loadAllTextures(): Promise<boolean> {
  if (loaded) return true                                                    // 已加载过则直接返回

  try {
    const keys = Object.keys(TEXTURE_PATHS)                                  // 获取所有纹理名称
    const loadPromises = keys.map(async (key) => {
      try {
        const texture = await Assets.load(TEXTURE_PATHS[key]!)               // 加载单个纹理
        textureCache.set(key, texture)                                       // 缓存纹理
      } catch {
        console.warn(`[TextureLoader] 加载失败: ${key} (${TEXTURE_PATHS[key]})`) // 单个失败不阻塞
      }
    })

    await Promise.all(loadPromises)                                          // 并行加载所有纹理
    loaded = true                                                            // 标记加载完成
    console.log(`[TextureLoader] 所有纹理加载完成，共 ${textureCache.size}/${keys.length} 个`)
    return true
  } catch (err) {
    console.error('[TextureLoader] 纹理加载出错:', err)
    loaded = true                                                            // 即使出错也标记完成，使用回退图形
    return false
  }
}

/**
 * 获取已加载的纹理
 * @param name 纹理名称
 * @returns 纹理对象，未加载则返回 null
 */
export function getTexture(name: string): Texture | null {
  return textureCache.get(name) ?? null                                      // 从缓存获取
}

/**
 * 检查纹理是否已完成加载
 * @returns 是否已加载
 */
export function isTexturesLoaded(): boolean {
  return loaded
}
