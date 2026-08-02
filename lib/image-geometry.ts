// 图片几何与点击坐标工具
// 用于将实际渲染的图片边界与容器边界区分开，避免 letterbox 偏移

export interface ContainedImageRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * 计算 object-fit: contain 下图片在容器内的实际渲染矩形。
 * scale = min(containerWidth/imageWidth, containerHeight/imageHeight)
 * 渲染宽度 = imageWidth * scale
 */
export function getContainedImageRect(input: {
  containerWidth: number;
  containerHeight: number;
  imageWidth: number;
  imageHeight: number;
}): ContainedImageRect {
  const { containerWidth, containerHeight, imageWidth, imageHeight } = input;
  if (
    containerWidth <= 0 ||
    containerHeight <= 0 ||
    imageWidth <= 0 ||
    imageHeight <= 0
  ) {
    return { left: 0, top: 0, width: 0, height: 0 };
  }
  const scale = Math.min(containerWidth / imageWidth, containerHeight / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  const left = (containerWidth - width) / 2;
  const top = (containerHeight - height) / 2;
  return { left, top, width, height };
}

export interface NormalizedPoint {
  x: number;
  y: number;
}

/**
 * 将客户端指针位置转换为图片内 0..1 归一化坐标。
 * 指针落在 letterbox 区域（图片实际渲染矩形之外）返回 null。
 *
 * 注意：containerRect 描述容器的视口位置（left/top 是浏览器坐标）；
 * imageRect 描述图片在容器内的位置（left/top 是相对于容器的偏移）。
 */
export function pointerToNormalizedPoint(
  clientX: number,
  clientY: number,
  containerRect: { left: number; top: number; width: number; height: number },
  imageRect: ContainedImageRect
): NormalizedPoint | null {
  const localX = clientX - containerRect.left;
  const localY = clientY - containerRect.top;
  // imageRect.left/top 是相对于容器的偏移（来自 getContainedImageRect）
  const dx = localX - imageRect.left;
  const dy = localY - imageRect.top;
  if (dx < 0 || dy < 0 || dx > imageRect.width || dy > imageRect.height) {
    return null;
  }
  if (imageRect.width === 0 || imageRect.height === 0) {
    return null;
  }
  return { x: dx / imageRect.width, y: dy / imageRect.height };
}

/**
 * 场景区域命中检测：给定点是否落在某个 SceneRegion 内。
 */
export function hitTestRegions(
  point: NormalizedPoint,
  regions: ReadonlyArray<{ id: string; box: { x: number; y: number; width: number; height: number } }>
): string | null {
  for (const r of regions) {
    const b = r.box;
    if (
      point.x >= b.x &&
      point.x <= b.x + b.width &&
      point.y >= b.y &&
      point.y <= b.y + b.height
    ) {
      return r.id;
    }
  }
  return null;
}