import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { dataSourceOptions } from 'src/infrastructure/data-source';
import { UserEntity } from 'src/auth/entities/user.entity';
import { CategoryEntity } from 'src/categories/entities/category.entity';
import { DEFAULT_CATEGORIES } from './default-categories';

/**
 * Carga el set inicial de categorías para el usuario propietario.
 * Es idempotente: se salta las que ya existen, así que se puede correr de nuevo
 * tras agregar entradas nuevas a DEFAULT_CATEGORIES.
 */
async function run(): Promise<void> {
  const dataSource = await new DataSource(dataSourceOptions).initialize();

  try {
    const user = await dataSource
      .getRepository(UserEntity)
      .findOne({ where: {}, order: { id: 'ASC' } });

    if (!user) {
      throw new Error(
        'No hay ningún usuario todavía: registra al propietario con POST /api/auth/register antes de sembrar',
      );
    }

    const categoryRepository = dataSource.getRepository(CategoryEntity);
    const existing = await categoryRepository.findBy({ userId: user.id });
    const taken = new Set(
      existing.map((category) => `${category.type}:${category.name.toLowerCase()}`),
    );

    const pending = DEFAULT_CATEGORIES.filter(
      (seed) => !taken.has(`${seed.type}:${seed.name.toLowerCase()}`),
    );

    if (pending.length === 0) {
      console.log(`Sin cambios: ${user.email} ya tiene todas las categorías base`);
      return;
    }

    await categoryRepository.save(
      pending.map((seed) => categoryRepository.create({ ...seed, userId: user.id })),
    );

    console.log(`Sembradas ${pending.length} categoría(s) para ${user.email}:`);
    for (const seed of pending) console.log(`  - [${seed.type}] ${seed.name}`);
  } finally {
    await dataSource.destroy();
  }
}

void run();
