import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  AlertsService,
  MAX_SEND_ATTEMPTS,
  daysBetween,
} from 'src/alerts/alerts.service';
import { AlertEntity } from 'src/alerts/entities/alert.entity';
import { CommitmentOccurrenceEntity } from 'src/occurrences/entities/commitment-occurrence.entity';
import { UserEntity } from 'src/auth/entities/user.entity';
import { AlertKind } from 'src/alerts/enums/alert-kind.enum';
import { NOTIFICATION_CHANNEL } from 'src/alerts/notifications/notification.interface';
import { TelegramMockService } from 'src/alerts/notifications/telegram-mock.service';

describe('AlertsService', () => {
  let service: AlertsService;
  let alertRepo: jest.Mocked<Repository<AlertEntity>>;
  let channel: TelegramMockService;

  const buildOccurrence = (
    overrides: Partial<CommitmentOccurrenceEntity> = {},
  ): CommitmentOccurrenceEntity =>
    ({
      id: 1,
      dueDate: '2026-09-11',
      expectedAmount: 3200,
      paidAmount: 0,
      installmentNumber: null,
      commitment: {
        name: 'Tarjeta AMEX',
        alertDaysBefore: [5, 1, 0],
        totalInstallments: null,
      },
      ...overrides,
    }) as CommitmentOccurrenceEntity;

  const buildUser = (overrides: Partial<UserEntity> = {}): UserEntity =>
    ({
      id: 1,
      telegramChatId: '123456789',
      timezone: 'America/Mexico_City',
      ...overrides,
    }) as UserEntity;

  const buildAlert = (overrides: Partial<AlertEntity> = {}): AlertEntity =>
    ({
      id: 10,
      userId: 1,
      occurrenceId: 1,
      message: 'aviso',
      attempts: 0,
      sentAt: null,
      ...overrides,
    }) as AlertEntity;

  beforeEach(async () => {
    channel = new TelegramMockService();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertsService,
        {
          provide: getRepositoryToken(AlertEntity),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            update: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(CommitmentOccurrenceEntity),
          useValue: { createQueryBuilder: jest.fn() },
        },
        { provide: NOTIFICATION_CHANNEL, useValue: channel },
      ],
    }).compile();

    service = module.get(AlertsService);
    alertRepo = module.get(getRepositoryToken(AlertEntity));
  });

  describe('daysBetween', () => {
    it.each([
      ['2026-09-06', '2026-09-11', 5],
      ['2026-09-11', '2026-09-11', 0],
      ['2026-09-12', '2026-09-11', -1],
      ['2026-02-26', '2026-03-01', 3],
    ])('de %s a %s hay %i días', (from, to, expected) => {
      expect(daysBetween(from, to)).toBe(expected);
    });

    it('no se desfasa al cruzar el cambio de horario', () => {
      // En México el horario de verano terminaba a finales de octubre; con
      // fechas UTC puras la cuenta no pierde ni gana un día.
      expect(daysBetween('2026-10-25', '2026-11-01')).toBe(7);
    });
  });

  describe('plannedAlert', () => {
    it('avisa en los días configurados', () => {
      expect(service.plannedAlert(buildOccurrence(), '2026-09-06')).toEqual({
        kind: AlertKind.UPCOMING,
        daysBefore: 5,
      });
      expect(service.plannedAlert(buildOccurrence(), '2026-09-10')).toEqual({
        kind: AlertKind.UPCOMING,
        daysBefore: 1,
      });
    });

    it('calla en un día que no está configurado', () => {
      expect(service.plannedAlert(buildOccurrence(), '2026-09-08')).toBeNull();
    });

    it('el día del vencimiento manda DUE_TODAY, no UPCOMING', () => {
      expect(service.plannedAlert(buildOccurrence(), '2026-09-11')).toEqual({
        kind: AlertKind.DUE_TODAY,
        daysBefore: 0,
      });
    });

    it('después de la fecha manda OVERDUE', () => {
      expect(service.plannedAlert(buildOccurrence(), '2026-09-12')).toEqual({
        kind: AlertKind.OVERDUE,
        daysBefore: 0,
      });
    });

    it('respeta una configuración propia de días', () => {
      const occurrence = buildOccurrence({
        commitment: {
          name: 'Renta',
          alertDaysBefore: [10],
          totalInstallments: null,
        } as CommitmentOccurrenceEntity['commitment'],
      });

      expect(service.plannedAlert(occurrence, '2026-09-01')).toEqual({
        kind: AlertKind.UPCOMING,
        daysBefore: 10,
      });
      expect(service.plannedAlert(occurrence, '2026-09-06')).toBeNull();
    });

    it('sin días configurados solo avisa el día del vencimiento y después', () => {
      const occurrence = buildOccurrence({
        commitment: {
          name: 'Sin avisos',
          alertDaysBefore: [],
          totalInstallments: null,
        } as CommitmentOccurrenceEntity['commitment'],
      });

      expect(service.plannedAlert(occurrence, '2026-09-06')).toBeNull();
      expect(service.plannedAlert(occurrence, '2026-09-11')).toEqual({
        kind: AlertKind.DUE_TODAY,
        daysBefore: 0,
      });
    });
  });

  describe('dispatchForUser', () => {
    it('envía lo pendiente y lo marca como enviado', async () => {
      alertRepo.find.mockResolvedValue([buildAlert()]);

      const sent = await service.dispatchForUser(buildUser());

      expect(sent).toBe(1);
      expect(channel.sent).toEqual([{ chatId: '123456789', message: 'aviso' }]);
      expect(alertRepo.update).toHaveBeenCalledWith(
        { id: 10 },
        expect.objectContaining({ attempts: 1, lastError: null }),
      );
    });

    it('no manda nada si falta el chat de Telegram', async () => {
      alertRepo.find.mockResolvedValue([buildAlert()]);

      const sent = await service.dispatchForUser(
        buildUser({ telegramChatId: null }),
      );

      expect(sent).toBe(0);
      expect(channel.sent).toHaveLength(0);
    });

    it('un fallo no tumba el lote y queda registrado para reintentar', async () => {
      alertRepo.find.mockResolvedValue([
        buildAlert({ id: 10 }),
        buildAlert({ id: 11 }),
      ]);
      jest
        .spyOn(channel, 'send')
        .mockRejectedValueOnce(new Error('chat not found'))
        .mockResolvedValueOnce(undefined);

      const sent = await service.dispatchForUser(buildUser());

      expect(sent).toBe(1);
      expect(alertRepo.update).toHaveBeenCalledWith(
        { id: 10 },
        expect.objectContaining({ lastError: 'chat not found' }),
      );
    });

    it('deja de reintentar tras el máximo de intentos', async () => {
      alertRepo.find.mockResolvedValue([
        buildAlert({ attempts: MAX_SEND_ATTEMPTS }),
      ]);

      const sent = await service.dispatchForUser(buildUser());

      expect(sent).toBe(0);
      expect(channel.sent).toHaveLength(0);
    });
  });
});
