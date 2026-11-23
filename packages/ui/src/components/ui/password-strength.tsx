"use client"

import { cn } from "../../lib/utils"

/**
 * One password strength meter for the whole product.
 *
 * There were three, and they had all drifted: main's signup and main's settings scored on
 * four rules and painted the top two levels emerald; the firm's signup scored on FIVE
 * different rules and painted the bottom two red. The same password therefore got a
 * different verdict depending on which page you typed it into, which is worse than having
 * no meter at all - it makes the advice look arbitrary, because it is.
 *
 * ─── WHY IT NAMES WHAT IS MISSING ──────────────────────────────────────────────
 * A bar that stops at three of four and says "Strong" is a dead end: the user adds more
 * characters, nothing moves, and the only available conclusion is that the meter is broken.
 * It was not - `someone@3110223232323dswfenindefsdfnsdifnsdifns` is 44 characters with a
 * digit and a symbol and no CAPITAL LETTER, so it scored 3 and could never score 4 no
 * matter how much more was typed.
 *
 * So the meter says what the missing rule is. A strength meter that cannot be satisfied and
 * will not say why is just a decoration that occasionally insults you.
 */

interface Rule {
    /** Shown as "Add ..." when this is the first unmet rule. */
    hint: string
    test: (pw: string) => boolean
}

/**
 * Four rules, four bars. Deliberately not "length alone", and deliberately not five rules
 * with two length tiers (the firm's old version) - a second length tier makes the bar move
 * for typing more of the same character, which flatters a bad password.
 */
const RULES: readonly Rule[] = [
    { hint: "at least 8 characters", test: (p) => p.length >= 8 },
    { hint: "a capital letter", test: (p) => /[A-Z]/.test(p) },
    { hint: "a number", test: (p) => /[0-9]/.test(p) },
    { hint: "a symbol", test: (p) => /[^A-Za-z0-9]/.test(p) },
]

export const PASSWORD_STRENGTH_LEVELS = RULES.length

/** 0-4. Zero means an empty box or nothing satisfied, not "weak". */
export function passwordScore(pw: string): number {
    if (!pw) return 0
    return RULES.reduce((n, r) => (r.test(pw) ? n + 1 : n), 0)
}

/** The first rule this password does not satisfy, or null when it satisfies all of them. */
export function passwordHint(pw: string): string | null {
    const missing = RULES.find((r) => !r.test(pw))
    return missing ? `Add ${missing.hint}` : null
}

const LABELS = ["Too weak", "Weak", "Fair", "Strong", "Excellent"]

/**
 * A monochrome ramp, not a traffic light.
 *
 * The emerald that used to sit on levels 3 and 4 was off-brand (CLAUDE.md keeps green for
 * SUCCESS, and a password being long enough is not a success) and it read as loud next to a
 * black-and-neutral form. Filling in from pale to solid says "more" without borrowing a
 * meaning the colour does not have here.
 */
const SKIN = {
    auth: {
        track: "bg-[var(--so-line)]",
        fill: ["", "bg-[var(--so-ink-5)]", "bg-[var(--so-ink-4)]", "bg-[var(--so-ink-2)]", "bg-[var(--so-ink)]"],
        label: "text-[var(--so-ink-3)]",
        hint: "text-[var(--so-ink-4)]",
    },
    app: {
        track: "bg-neutral-200 dark:bg-neutral-700",
        fill: [
            "",
            "bg-neutral-400 dark:bg-neutral-600",
            "bg-neutral-500 dark:bg-neutral-500",
            "bg-neutral-700 dark:bg-neutral-300",
            "bg-neutral-900 dark:bg-white",
        ],
        label: "text-neutral-600 dark:text-neutral-400",
        hint: "text-neutral-500 dark:text-neutral-400",
    },
} as const

interface PasswordStrengthProps {
    value: string
    variant?: keyof typeof SKIN
    className?: string
    /** Rendered on the right of the label row - e.g. a "passwords match" note. */
    trailing?: React.ReactNode
}

export function PasswordStrength({ value, variant = "auth", className, trailing }: PasswordStrengthProps) {
    if (!value) return null

    const score = passwordScore(value)
    const hint = passwordHint(value)
    const skin = SKIN[variant]

    return (
        <div className={cn("space-y-1.5 pt-1", className)}>
            <div className="flex gap-1" role="progressbar" aria-valuemin={0} aria-valuemax={PASSWORD_STRENGTH_LEVELS} aria-valuenow={score} aria-label="Password strength">
                {Array.from({ length: PASSWORD_STRENGTH_LEVELS }, (_, i) => (
                    <div
                        key={i}
                        className={cn(
                            "h-1.5 flex-1 rounded-full transition-all duration-300",
                            i < score ? skin.fill[score] : skin.track,
                        )}
                    />
                ))}
            </div>
            <div className="flex items-center justify-between gap-3">
                <p className={cn("text-[11px]", skin.label)}>
                    <span className="font-medium">{LABELS[score]}</span>
                    {hint ? <span className={skin.hint}> - {hint.toLowerCase()}</span> : null}
                </p>
                {trailing}
            </div>
        </div>
    )
}
