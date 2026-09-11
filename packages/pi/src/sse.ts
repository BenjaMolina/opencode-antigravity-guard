const MAX_RECORD_BYTES = 1024 * 1024

export class SseFrameError extends Error {}

export class SseFramer {
  private decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true })
  private data: string[] = []
  private line: string[] = []
  private recordBytes = 0
  private carriageReturn = false
  private bom = true

  push(bytes: Uint8Array): string[] {
    const records: string[] = []
    let start = 0
    for (let index = 0; index < bytes.length; index++) {
      if (this.carriageReturn) {
        if (bytes[index] === 10) {
          this.count(1)
          this.endLine(records)
          this.carriageReturn = false
          start = index + 1
          continue
        }
        this.endLine(records)
        this.carriageReturn = false
      }
      const byte = bytes[index]
      if (byte === 10 || byte === 13) {
        this.append(bytes.subarray(start, index))
        this.count(1)
        if (byte === 13) this.carriageReturn = true
        else this.endLine(records)
        start = index + 1
      }
    }
    this.append(bytes.subarray(start))
    return records
  }

  finish(): string[] {
    const records: string[] = []
    if (this.carriageReturn) { this.endLine(records); this.carriageReturn = false }
    this.flush()
    if (this.line.length || this.data.length || this.recordBytes) throw new SseFrameError("SSE stream ended with an unterminated record.")
    return records
  }

  private append(bytes: Uint8Array): void {
    if (!bytes.length) return
    this.count(bytes.length)
    try {
      let text = this.decoder.decode(bytes, { stream: true })
      if (this.bom && text) { this.bom = false; if (text.startsWith("\ufeff")) text = text.slice(1) }
      if (text) this.line.push(text)
    } catch { throw new SseFrameError("SSE stream contains invalid UTF-8.") }
  }

  private flush(): void {
    try {
      const text = this.decoder.decode()
      if (this.bom) { this.bom = false; if (text.startsWith("\ufeff")) this.line.push(text.slice(1)) }
      else if (text) this.line.push(text)
    } catch { throw new SseFrameError("SSE stream contains invalid UTF-8.") }
  }

  private count(bytes: number): void {
    this.recordBytes += bytes
    if (this.recordBytes > MAX_RECORD_BYTES) throw new SseFrameError("SSE record is too large.")
  }

  private endLine(records: string[]): void {
    this.flush()
    const line = this.line.join("")
    if (!line) {
      if (this.data.length) records.push(this.data.join("\n"))
      this.data = []
      this.recordBytes = 0
    } else if (!line.startsWith(":")) {
      const separator = line.indexOf(":")
      const field = separator === -1 ? line : line.slice(0, separator)
      let value = separator === -1 ? "" : line.slice(separator + 1)
      if (value.startsWith(" ")) value = value.slice(1)
      if (field === "data") this.data.push(value)
    }
    this.line = []
    this.decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true })
  }
}
