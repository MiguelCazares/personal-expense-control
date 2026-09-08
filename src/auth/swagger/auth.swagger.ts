import { applyDecorators } from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiUnauthorizedResponse,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { AuthResponseDto, PublicUserDto } from 'src/auth/dto/auth-response.dto';

const authSuccessExample = {
  status: 'success',
  data: {
    access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    user: {
      id: 1,
      email: 'miguel@example.com',
      name: 'Miguel',
      timezone: 'America/Mexico_City',
      telegramChatId: null,
      createdAt: '2026-09-08T18:00:00.000Z',
    },
  },
};

export const AuthSwagger = {
  Register: () =>
    applyDecorators(
      ApiCreatedResponse({
        description: 'Usuario propietario creado.',
        type: AuthResponseDto,
        schema: { example: authSuccessExample },
      }),
      ApiForbiddenResponse({
        description: 'Ya existe un usuario: el registro está cerrado.',
      }),
      ApiUnprocessableEntityResponse({ description: 'Payload inválido.' }),
    ),

  Login: () =>
    applyDecorators(
      ApiOkResponse({
        description: 'Sesión iniciada.',
        type: AuthResponseDto,
        schema: { example: authSuccessExample },
      }),
      ApiUnauthorizedResponse({ description: 'Credenciales inválidas.' }),
      ApiUnprocessableEntityResponse({ description: 'Payload inválido.' }),
    ),

  Me: () =>
    applyDecorators(
      ApiOkResponse({
        description: 'Usuario autenticado.',
        type: PublicUserDto,
        schema: {
          example: { status: 'success', data: authSuccessExample.data.user },
        },
      }),
      ApiUnauthorizedResponse({ description: 'Token ausente o inválido.' }),
    ),
};
