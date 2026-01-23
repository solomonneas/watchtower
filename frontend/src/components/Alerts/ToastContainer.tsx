import { useAlerts } from '../../hooks/useAlerts'
import Toast from './Toast'

export default function ToastContainer() {
  const { toasts, dismissToast, acknowledgeAlert } = useAlerts()

  const visibleToasts = toasts.filter((t) => !t.dismissed)

  if (visibleToasts.length === 0) {
    return null
  }

  return (
    <div className="fixed top-20 right-4 z-50 flex flex-col gap-3">
      {visibleToasts.slice(0, 5).map((toast) => (
        <Toast
          key={toast.id}
          toast={toast}
          onDismiss={dismissToast}
          onAcknowledge={acknowledgeAlert}
        />
      ))}

      {visibleToasts.length > 5 && (
        <div className="text-sm text-text-muted text-right pr-2">
          +{visibleToasts.length - 5} more alerts
        </div>
      )}
    </div>
  )
}
