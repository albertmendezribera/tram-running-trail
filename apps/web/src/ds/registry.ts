import ActionsFiche from './fiches/ActionsFiche.astro';
import BibFiche from './fiches/BibFiche.astro';
import ClimbFiche from './fiches/ClimbFiche.astro';
import DataTableFiche from './fiches/DataTableFiche.astro';
import ElevationFiche from './fiches/ElevationFiche.astro';
import Foundations from './fiches/Foundations.astro';
import Index from './fiches/Index.astro';
import LayoutFiche from './fiches/LayoutFiche.astro';
import MediaFiche from './fiches/MediaFiche.astro';
import MeasureFiche from './fiches/MeasureFiche.astro';
import ModesFiche from './fiches/ModesFiche.astro';
import MomentM2 from './fiches/MomentM2.astro';
import SegmentedFiche from './fiches/SegmentedFiche.astro';
import StatBlockFiche from './fiches/StatBlockFiche.astro';
import TextFiche from './fiches/TextFiche.astro';
import ThemeToggleFiche from './fiches/ThemeToggleFiche.astro';
import ViewerFiche from './fiches/ViewerFiche.astro';

export const FICHES = [
  { slug: undefined, title: 'Catàleg', Page: Index },
  { slug: 'fonaments', title: 'Fonaments', Page: Foundations },
  { slug: 'modes', title: 'Modes', Page: ModesFiche },
  { slug: 'primitives/text', title: 'Text i títols', Page: TextFiche },
  { slug: 'primitives/actions', title: 'Enllaç i botó', Page: ActionsFiche },
  { slug: 'primitives/media', title: 'Icona, filet i figura', Page: MediaFiche },
  { slug: 'primitives/layout', title: 'Composició', Page: LayoutFiche },
  { slug: 'primitives/measure', title: 'Measure', Page: MeasureFiche },
  { slug: 'primitives/data-table', title: 'DataTable', Page: DataTableFiche },
  { slug: 'patterns/bib', title: 'Bib', Page: BibFiche },
  { slug: 'patterns/stat-block', title: 'StatBlock', Page: StatBlockFiche },
  { slug: 'patterns/elevation-profile', title: 'ElevationProfile', Page: ElevationFiche },
  { slug: 'patterns/climb-list', title: 'ClimbList', Page: ClimbFiche },
  { slug: 'interactive/segmented-control', title: 'SegmentedControl', Page: SegmentedFiche },
  { slug: 'interactive/theme-toggle', title: 'ThemeToggle', Page: ThemeToggleFiche },
  { slug: 'interactive/viewer-3d-shell', title: 'Viewer3DShell', Page: ViewerFiche },
  { slug: 'moments/recorrer-el-tram', title: 'M2 · Recórrer el tram', Page: MomentM2 },
];
