import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';

const transactionExample = {
  id: 12,
  userId: 1,
  type: 'EXPENSE',
  amount: 1250.5,
  occurredOn: '2026-09-11',
  categoryId: 4,
  category: {
    id: 4,
    name: 'Tarjeta de crédito AMEX',
    type: 'EXPENSE',
    nature: 'FIXED',
  },
  note: 'Pago mensualidad',
  createdAt: '2026-09-11T18:00:00.000Z',
  updatedAt: '2026-09-11T18:00:00.000Z',
};

export const TransactionsSwagger = {
  Create: () =>
    applyDecorators(
      ApiCreatedResponse({
        description:
          'Movimiento creado. El `type` se toma de la categoría, no del payload.',
        schema: { example: { status: 'success', data: transactionExample } },
      }),
      ApiNotFoundResponse({ description: 'La categoría no existe.' }),
      ApiBadRequestResponse({ description: 'La categoría está archivada.' }),
      ApiUnprocessableEntityResponse({ description: 'Payload inválido.' }),
    ),

  FindAll: () =>
    applyDecorators(
      ApiOkResponse({
        description: 'Listado paginado, del más reciente al más antiguo.',
        schema: {
          example: {
            status: 'success',
            data: {
              data: [transactionExample],
              meta: { total: 1, currentPage: 1, totalPages: 1, perPage: 10 },
            },
          },
        },
      }),
      ApiBadRequestResponse({ description: 'Rango de fechas invertido.' }),
    ),

  FindOne: () =>
    applyDecorators(
      ApiOkResponse({
        description: 'Movimiento encontrado.',
        schema: { example: { status: 'success', data: transactionExample } },
      }),
      ApiNotFoundResponse({ description: 'No existe o es de otro usuario.' }),
    ),

  Update: () =>
    applyDecorators(
      ApiOkResponse({
        description: 'Movimiento actualizado.',
        schema: { example: { status: 'success', data: transactionExample } },
      }),
      ApiNotFoundResponse({ description: 'No existe o es de otro usuario.' }),
    ),

  Remove: () =>
    applyDecorators(
      ApiNoContentResponse({ description: 'Movimiento borrado.' }),
      ApiNotFoundResponse({ description: 'No existe o es de otro usuario.' }),
    ),
};
