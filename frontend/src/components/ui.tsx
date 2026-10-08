// Small shared building blocks. Restyle here once and the whole app follows.
import type { ButtonHTMLAttributes, HTMLAttributes, InputHTMLAttributes } from 'react'

const cx = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(' ')

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'danger' }

export function Button({ variant = 'primary', className, ...props }: ButtonProps) {
  const styles = {
    primary: 'bg-brand text-white hover:bg-brand-dark',
    ghost: 'text-slate-700 hover:bg-slate-200',
    danger: 'text-red-600 hover:bg-red-50',
  }[variant]
  return (
    <button
      className={cx(
        'rounded-lg px-4 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        styles,
        className,
      )}
      {...props}
    />
  )
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cx(
        'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/20',
        className,
      )}
      {...props}
    />
  )
}

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cx('rounded-xl border border-slate-200 bg-white p-5 shadow-sm', className)} {...props} />
}

export function ErrorText({ children }: { children?: string | null }) {
  return children ? <p className="text-sm text-red-600">{children}</p> : null
}
