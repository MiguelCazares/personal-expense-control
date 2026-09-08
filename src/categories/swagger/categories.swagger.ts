import { applyDecorators } from '@nestjs/common';
import {
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { CategoryEntity } from 'src/categories/entities/category.entity';

const categoryExample = {
  id: 4,
  userId: 1,
  name: 'Tarjeta de crédito AMEX',
  type: 'EXPENSE',
  nature: 'FIXED',
  color: '#00b2e3',
  icon: 'mdi-credit-card',
  isArchived: false,
  createdAt: '2026-09-08T18:00:00.000Z',
  updatedAt: '2026-09-08T18:00:00.000Z',
};

export const CategoriesSwagger = {
  Create: () =>
    applyDecorators(
      ApiCreatedResponse({
        description: 'Categoría creada.',
        type: CategoryEntity,
        schema: { example: { status: 'success', data: categoryExample } },
      }),
      ApiConflictResponse({
        description: 'Ya existe una categoría con ese nombre y tipo.',
      }),
      ApiUnprocessableEntityResponse({ description: 'Payload inválido.' }),
    ),

  FindAll: () =>
    applyDecorators(
      ApiOkResponse({
        description: 'Listado paginado, ordenado por nombre.',
        schema: {
          example: {
            status: 'success',
            data: {
              data: [categoryExample],
              meta: { total: 1, currentPage: 1, totalPages: 1, perPage: 10 },
            },
          },
        },
      }),
    ),

  FindOne: () =>
    applyDecorators(
      ApiOkResponse({
        description: 'Categoría encontrada.',
        schema: { example: { status: 'success', data: categoryExample } },
      }),
      ApiNotFoundResponse({ description: 'No existe o es de otro usuario.' }),
    ),

  Update: () =>
    applyDecorators(
      ApiOkResponse({
        description: 'Categoría actualizada.',
        schema: { example: { status: 'success', data: categoryExample } },
      }),
      ApiNotFoundResponse({ description: 'No existe o es de otro usuario.' }),
      ApiConflictResponse({ description: 'El nombre ya está tomado.' }),
    ),

  Remove: () =>
    applyDecorators(
      ApiNoContentResponse({ description: 'Categoría borrada.' }),
      ApiNotFoundResponse({ description: 'No existe o es de otro usuario.' }),
      ApiConflictResponse({
        description: 'Tiene movimientos: hay que archivarla, no borrarla.',
      }),
    ),
};
