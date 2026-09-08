export const NOTIFICATION_CHANNEL = Symbol('NOTIFICATION_CHANNEL');

export interface INotificationChannel {
  /**
   * Entrega el mensaje. Lanza si no se pudo: el llamador registra el error y
   * deja la alerta sin `sentAt` para reintentarla.
   */
  send(chatId: string, message: string): Promise<void>;
}
