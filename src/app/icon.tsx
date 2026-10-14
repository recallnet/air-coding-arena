import { ImageResponse } from 'next/og'

/**
 * Favicon dimensions in pixels.
 * Standard size for browser tabs and bookmarks.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/app-icons
 */
export const size = {
  /** Icon width in pixels */
  width: 32,
  /** Icon height in pixels */
  height: 32,
}

/**
 * MIME type for the generated favicon.
 *
 * @see https://nextjs.org/docs/app/api-reference/file-conventions/metadata/app-icons
 */
export const contentType = 'image/png'

/**
 * Icon component - minimal dark design matching Geist aesthetic
 * @returns ImageResponse containing the icon
 */
export default function Icon() {
  return new ImageResponse(
    <div
      style={{
        fontSize: 20,
        background: '#000000',
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fafafa',
        fontWeight: 600,
        fontFamily: 'monospace',
        letterSpacing: '-0.05em',
      }}
    >
      {'</>'}
    </div>,
    {
      ...size,
    }
  )
}
