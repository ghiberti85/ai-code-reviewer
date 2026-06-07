import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FileDropZone } from '../../components/FileDropZone'

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}))

beforeEach(() => {
  vi.restoreAllMocks()
})

describe('FileDropZone', () => {
  it('renders the upload label', () => {
    render(<FileDropZone onLoad={vi.fn()} />)
    expect(screen.getByText('Upload file')).toBeInTheDocument()
  })

  it('calls onLoad with file content and detected language on valid file input', async () => {
    const onLoad = vi.fn()

    const readAsText = vi.fn()
    let readerOnload: ((e: ProgressEvent<FileReader>) => void) | null = null

    function MockFileReader(this: any) {
      this.readAsText = readAsText.mockImplementation(function(this: any) {
        // simulate async load
        readerOnload?.({ target: { result: 'const x = 1' } } as any)
      })
      Object.defineProperty(this, 'onload', {
        set(fn: any) { readerOnload = fn },
        get() { return readerOnload },
        configurable: true,
      })
    }
    vi.stubGlobal('FileReader', MockFileReader)

    render(<FileDropZone onLoad={onLoad} />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['const x = 1'], 'index.ts', { type: 'text/plain' })
    fireEvent.change(input, { target: { files: [file] } })

    expect(onLoad).toHaveBeenCalledWith('const x = 1', 'typescript')
  })

  it('shows error message for files exceeding 50KB', () => {
    const onLoad = vi.fn()
    render(<FileDropZone onLoad={onLoad} />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const bigContent = 'x'.repeat(50_001)
    const file = new File([bigContent], 'big.ts', { type: 'text/plain' })
    Object.defineProperty(file, 'size', { value: 50_001 })

    fireEvent.change(input, { target: { files: [file] } })

    expect(screen.getByText('File too large (max 50KB)')).toBeInTheDocument()
    expect(onLoad).not.toHaveBeenCalled()
  })

  it('defaults to javascript for unknown extension', async () => {
    const onLoad = vi.fn()

    let readerOnload: ((e: ProgressEvent<FileReader>) => void) | null = null
    function MockFileReader(this: any) {
      this.readAsText = vi.fn().mockImplementation(function() {
        readerOnload?.({ target: { result: 'code' } } as any)
      })
      Object.defineProperty(this, 'onload', {
        set(fn: any) { readerOnload = fn },
        get() { return readerOnload },
        configurable: true,
      })
    }
    vi.stubGlobal('FileReader', MockFileReader)

    render(<FileDropZone onLoad={onLoad} />)

    const input = document.querySelector('input[type="file"]') as HTMLInputElement
    const file = new File(['code'], 'script.xyz', { type: 'text/plain' })
    fireEvent.change(input, { target: { files: [file] } })

    expect(onLoad).toHaveBeenCalledWith('code', 'javascript')
  })
})
