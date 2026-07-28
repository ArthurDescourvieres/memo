import { describe, it, expect } from 'vitest'
import {
  registerSchema,
  loginSchema,
  changePasswordSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from './auth.schema'

describe('register password policy (§5.3)', () => {
  it('rejects passwords shorter than 12 characters', () => {
    const result = registerSchema.safeParse({
      name: 'Ada',
      email: 'ada@example.com',
      password: 'short-pass', // 10 chars
    })
    expect(result.success).toBe(false)
  })

  it('accepts a password of at least 12 characters', () => {
    const result = registerSchema.safeParse({
      name: 'Ada',
      email: 'ada@example.com',
      password: 'a-sufficiently-long-passphrase',
    })
    expect(result.success).toBe(true)
  })
})

describe('login schema', () => {
  it('does not impose the 12-char minimum on login', () => {
    const result = loginSchema.safeParse({ identifier: 'ada@example.com', password: 'legacy' })
    expect(result.success).toBe(true)
  })
})

describe('change password schema', () => {
  it('applies the 12-char policy to the new password', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'whatever',
      newPassword: 'too-short',
    })
    expect(result.success).toBe(false)
  })

  it('does not impose the policy on the current password (legacy accounts)', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: 'legacy',
      newPassword: 'a-sufficiently-long-passphrase',
    })
    expect(result.success).toBe(true)
  })

  it('requires the current password to be present', () => {
    const result = changePasswordSchema.safeParse({
      currentPassword: '',
      newPassword: 'a-sufficiently-long-passphrase',
    })
    expect(result.success).toBe(false)
  })
})

describe('password reset schemas', () => {
  it('rejects a malformed e-mail on the reset request', () => {
    expect(forgotPasswordSchema.safeParse({ email: 'not-an-email' }).success).toBe(false)
    expect(forgotPasswordSchema.safeParse({ email: 'ada@example.com' }).success).toBe(true)
  })

  it('applies the 12-char policy to the password chosen from a reset link', () => {
    expect(resetPasswordSchema.safeParse({ token: 'abc', password: 'short-pass' }).success).toBe(
      false,
    )
    expect(
      resetPasswordSchema.safeParse({ token: 'abc', password: 'a-sufficiently-long-passphrase' })
        .success,
    ).toBe(true)
  })

  it('requires a token', () => {
    const result = resetPasswordSchema.safeParse({
      token: '',
      password: 'a-sufficiently-long-passphrase',
    })
    expect(result.success).toBe(false)
  })
})
