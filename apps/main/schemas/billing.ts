import { z } from "zod"

/** The billing page's checkout request. Prices are never sent from the browser - the server looks them up. */
export const checkoutSchema = z.discriminatedUnion("kind", [
    z.object({
        kind: z.literal("plan"),
        plan: z.literal("pro"),
        months: z.union([z.literal(1), z.literal(3), z.literal(12)]),
        autoRenew: z.boolean(),
        currency: z.enum(["NPR", "INR", "USD"]),
        provider: z.enum(["esewa", "khalti", "razorpay", "cashfree", "stripe"]),
        phone: z.string().trim().max(20).optional(),
    }),
    z.object({
        kind: z.literal("credits"),
        pack: z.string().min(1).max(40),
        currency: z.enum(["NPR", "INR", "USD"]),
        provider: z.enum(["esewa", "khalti", "razorpay", "cashfree", "stripe"]),
        phone: z.string().trim().max(20).optional(),
    }),
])
export type CheckoutFormInput = z.infer<typeof checkoutSchema>

export const currencySchema = z.enum(["NPR", "INR", "USD"])
