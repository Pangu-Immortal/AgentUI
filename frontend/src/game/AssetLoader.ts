/**
 * 素材加载器 - AssetLoader.ts
 *
 * 从 Kenney CC0 tilemap PNG 中加载并切割出各个 tile 纹理：
 * - loadAllAssets(): 加载所有 tilemap 并缓存为纹理
 * - getTile(sheet, index): 获取指定 tile 的纹理
 *
 * 素材来源：Kenney (https://kenney.nl) CC0 公共领域
 */
import { Assets, Texture, Rectangle } from 'pixi.js'
import {
  ASSET_PATHS, SHEET_COLS, TILE_SIZE,
} from './TileConfig'

/** 素材包名称类型 */
type SheetName = keyof typeof ASSET_PATHS

/** 已加载的基础纹理缓存 */
const baseTextures: Partial<Record<SheetName, Texture>> = {}

/** tile 纹理缓存（避免重复创建） */
const tileCache: Map<string, Texture> = new Map()

/**
 * 加载所有 tilemap 基础纹理
 * 必须在使用 getTile 之前调用
 */
export async function loadAllAssets(): Promise<void> {
  console.log('[AssetLoader] 开始加载素材...')

  const entries = Object.entries(ASSET_PATHS) as [SheetName, string][]
  const promises = entries.map(async ([name, path]) => {
    try {
      const texture = await Assets.load<Texture>(path)          // 加载 PNG 为纹理
      baseTextures[name] = texture
      console.log(`[AssetLoader] 已加载 ${name}: ${path} 尺寸=${texture.width}x${texture.height}`)
    } catch (e) {
      console.warn(`[AssetLoader] 加载失败 ${name}: ${path}`, e)
    }
  })

  await Promise.all(promises)                                    // 并行加载所有素材包
  console.log('[AssetLoader] 所有素材加载完成')
}

/**
 * 获取指定 tile 的纹理
 * @param sheet 素材包名称 ('urban' | 'dungeon' | 'town')
 * @param index tile 索引编号
 * @returns PixiJS Texture，如果未加载则返回空白纹理
 */
export function getTile(sheet: SheetName, index: number): Texture {
  const cacheKey = `${sheet}_${index}`                           // 缓存键

  // 检查缓存
  const cached = tileCache.get(cacheKey)
  if (cached) return cached

  // 获取基础纹理
  const base = baseTextures[sheet]
  if (!base) {
    console.warn(`[AssetLoader] 素材包 ${sheet} 未加载`)
    return Texture.EMPTY
  }

  // 计算 tile 在 tilemap 上的矩形区域
  const cols = SHEET_COLS[sheet]
  const col = index % cols
  const row = Math.floor(index / cols)
  const x = col * TILE_SIZE
  const y = row * TILE_SIZE

  // 从基础纹理切割出子纹理（PixiJS 8 兼容写法）
  const frame = new Rectangle(x, y, TILE_SIZE, TILE_SIZE)
  // 使用 Texture 构造器，传入 source（TextureSource）和 frame
  const tile = new Texture({
    source: base.source,                                         // 共享底层 TextureSource
    frame,                                                       // 子区域矩形
  })

  tileCache.set(cacheKey, tile)                                  // 缓存
  console.log(`[AssetLoader] 切割 tile ${sheet}[${index}] frame=(${x},${y},${TILE_SIZE},${TILE_SIZE})`)
  return tile
}

/**
 * 检查素材包是否已加载
 */
export function isLoaded(sheet: SheetName): boolean {
  return !!baseTextures[sheet]
}
