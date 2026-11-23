import { z } from 'zod'

export const profileDetailsSchema = z.object({
    name: z.string().trim().min(1, 'Enter your name.').max(80, 'Keep the name under 80 characters.'),
    bio: z.string().trim().max(280, 'Keep the bio under 280 characters.'),
})

const newPassword = z.string().min(8, 'Use at least 8 characters for the password.').max(128, 'Keep the password under 128 characters.')

export const changePasswordSchema = z.object({
    currentPassword: z.string().min(1, 'Enter your current password.'),
    newPassword,
    revokeOtherSessions: z.boolean(),
})

export const setPasswordSchema = z.object({ newPassword })

export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const
/** The browser crops to 512px JPEG first; this is the ceiling for what it sends. */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024

export const avatarUploadSchema = z.object({
    contentType: z.enum(AVATAR_TYPES, { message: 'Use a JPG, PNG or WebP image.' }),
    size: z.number().int().positive('The image is empty.').max(AVATAR_MAX_BYTES, 'The image must be 2 MB or smaller.'),
})

export type ProfileDetailsInput = z.infer<typeof profileDetailsSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
