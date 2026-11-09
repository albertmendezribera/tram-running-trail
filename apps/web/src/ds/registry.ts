import BibFiche from './fiches/BibFiche.astro';
import DataTableFiche from './fiches/DataTableFiche.astro';
import Foundations from './fiches/Foundations.astro';
import Index from './fiches/Index.astro';
import MeasureFiche from './fiches/MeasureFiche.astro';
import SegmentedFiche from './fiches/SegmentedFiche.astro';
import StatBlockFiche from './fiches/StatBlockFiche.astro';

export const FICHES = [
  { slug: undefined, title: 'Catàleg', Page: Index },
  { slug: 'fonaments', title: 'Fonaments', Page: Foundations },
  { slug: 'primitives/measure', title: 'Measure', Page: MeasureFiche },
  { slug: 'primitives/data-table', title: 'DataTable', Page: DataTableFiche },
  { slug: 'patterns/bib', title: 'Bib', Page: BibFiche },
  { slug: 'patterns/stat-block', title: 'StatBlock', Page: StatBlockFiche },
  { slug: 'interactive/segmented-control', title: 'SegmentedControl', Page: SegmentedFiche },
];
