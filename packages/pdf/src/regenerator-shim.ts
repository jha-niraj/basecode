// @repo/pdf - the `regeneratorRuntime` global `@pdf-lib/fontkit` needs to shape complex scripts (Devanagari, Tamil...).
//
// `@pdf-lib/fontkit@1.1.1` was built by Babel with the regenerator transform and expects `regeneratorRuntime` as a
// GLOBAL it never ships. Latin never reaches that code; an Indic script does on its first character, so the font
// embeds cleanly and then throws `regeneratorRuntime is not defined` at the first draw. The one generator fontkit
// needs (StateMachine.match) is a plain `while (1) switch (_context.prev = _context.next)` loop, so this shim is that
// protocol and nothing more. An existing global (the real runtime) always wins. Must be imported BEFORE fontkit runs.

interface RegeneratorContext {
    prev: number | string
    next: number | string
    stop(): undefined
}

type GeneratedBody<T> = (context: RegeneratorContext) => T | undefined

interface RegeneratorRuntimeShim {
    mark<F>(fn: F): F
    wrap<T>(body: GeneratedBody<T>): IterableIterator<T>
}

function wrap<T>(body: GeneratedBody<T>): IterableIterator<T> {
    let finished = false
    const context: RegeneratorContext = {
        prev: 0,
        next: 0,
        stop() {
            finished = true
            return undefined
        },
    }
    const iterator: IterableIterator<T> = {
        next(): IteratorResult<T> {
            if (finished) return { value: undefined, done: true }
            const value = body(context)
            if (finished) return { value: undefined, done: true }
            return { value: value as T, done: false }
        },
        return(value?: T): IteratorResult<T> {
            finished = true
            return { value: value as T, done: true }
        },
        throw(err?: unknown): IteratorResult<T> {
            finished = true
            throw err
        },
        [Symbol.iterator]() {
            return this
        },
    }
    return iterator
}

const globals = globalThis as typeof globalThis & { regeneratorRuntime?: RegeneratorRuntimeShim }
if (!globals.regeneratorRuntime) {
    globals.regeneratorRuntime = { mark: (fn) => fn, wrap }
}

export {}
