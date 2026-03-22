export type AdminAlertType = 'success' | 'info' | 'warning' | 'error'

export type AdminAlertAction = () => void | Promise<void>

export interface AdminAlert {
  id: string
  type: AdminAlertType
  title?: string
  message: string
  duration?: number
  dismissible?: boolean
  createdAt: number
  actionLabel?: string
  action?: AdminAlertAction
  persistent?: boolean
}

export interface AdminAlertOptions {
  title?: string
  duration?: number
  dismissible?: boolean
  actionLabel?: string
  action?: AdminAlertAction
  persistent?: boolean
}

export interface AdminAlertPayload extends AdminAlertOptions {
  type?: AdminAlertType
  message: string
}
