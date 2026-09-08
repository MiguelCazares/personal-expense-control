import { MovementType } from 'src/common/enums/movement-type.enum';
import { CategoryNature } from 'src/categories/enums/category-nature.enum';

export interface CategorySeed {
  name: string;
  type: MovementType;
  nature: CategoryNature;
  color: string;
  icon: string;
}

/**
 * Set inicial. Las FIXED son las que en F2 colgarán un compromiso con su día
 * de vencimiento; las VARIABLE se registran a mano mes a mes.
 */
export const DEFAULT_CATEGORIES: CategorySeed[] = [
  {
    name: 'Nómina',
    type: MovementType.INCOME,
    nature: CategoryNature.FIXED,
    color: '#85cc41',
    icon: 'mdi-cash-multiple',
  },
  {
    name: 'Freelance',
    type: MovementType.INCOME,
    nature: CategoryNature.VARIABLE,
    color: '#00b2e3',
    icon: 'mdi-laptop',
  },
  {
    name: 'Tarjeta de crédito AMEX',
    type: MovementType.EXPENSE,
    nature: CategoryNature.FIXED,
    color: '#006fcf',
    icon: 'mdi-credit-card',
  },
  {
    name: 'Tarjeta de crédito BBVA',
    type: MovementType.EXPENSE,
    nature: CategoryNature.FIXED,
    color: '#004481',
    icon: 'mdi-credit-card',
  },
  {
    name: 'Préstamo 1',
    type: MovementType.EXPENSE,
    nature: CategoryNature.FIXED,
    color: '#fe4b26',
    icon: 'mdi-bank',
  },
  {
    name: 'Préstamo 2',
    type: MovementType.EXPENSE,
    nature: CategoryNature.FIXED,
    color: '#ff7043',
    icon: 'mdi-bank',
  },
  {
    name: 'Renta',
    type: MovementType.EXPENSE,
    nature: CategoryNature.FIXED,
    color: '#8e24aa',
    icon: 'mdi-home',
  },
  {
    name: 'Servicios',
    type: MovementType.EXPENSE,
    nature: CategoryNature.FIXED,
    color: '#ffc700',
    icon: 'mdi-flash',
  },
  {
    name: 'Supermercado',
    type: MovementType.EXPENSE,
    nature: CategoryNature.VARIABLE,
    color: '#43a047',
    icon: 'mdi-cart',
  },
  {
    name: 'Transporte',
    type: MovementType.EXPENSE,
    nature: CategoryNature.VARIABLE,
    color: '#546e7a',
    icon: 'mdi-car',
  },
  {
    name: 'Restaurantes',
    type: MovementType.EXPENSE,
    nature: CategoryNature.VARIABLE,
    color: '#ffd066',
    icon: 'mdi-silverware-fork-knife',
  },
  {
    name: 'Salud',
    type: MovementType.EXPENSE,
    nature: CategoryNature.VARIABLE,
    color: '#e53935',
    icon: 'mdi-medical-bag',
  },
];
