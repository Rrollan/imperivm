'use client';
import type {FormHTMLAttributes} from 'react';

/** iDos omits allow-forms from its iframe sandbox. Run app actions before native submission. */
export default function ActionForm({onAction, children, ...props}: Omit<FormHTMLAttributes<HTMLFormElement>, 'onSubmit' | 'onClick' | 'onKeyDown' | 'action'> & {onAction: () => void}) {
  return <form {...props} noValidate onSubmit={event => {event.preventDefault(); onAction();}}
    onClick={event => {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('button[type="submit"]') : null;
      if (!button || button.form !== event.currentTarget || button.disabled) return;
      event.preventDefault(); onAction();
    }} onKeyDown={event => {
      // Enter in a text input works in the sandbox too; IME and select/button keys retain their meaning.
      if (event.key !== 'Enter' || event.nativeEvent.isComposing || (event.target as Element).tagName !== 'INPUT') return;
      event.preventDefault();
      if (event.currentTarget.querySelector('button[type="submit"]:not(:disabled)')) onAction();
    }}>{children}</form>;
}
