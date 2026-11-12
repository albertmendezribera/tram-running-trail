import { loadTokenSet, type TokenSource } from './load.ts';
import { Diagnostics, type TokenSet } from './model.ts';
import { validate, validateTargetRequirements, validateTypeRoles } from './resolve.ts';
import { emitCatalog } from './targets/catalog.ts';
import { emitCss } from './targets/css.ts';
import { ECHARTS_REQUIREMENTS, emitEcharts } from './targets/echarts.ts';
import { emitOg } from './targets/og.ts';
import { emitThree } from './targets/three.ts';

export interface BuildResult {
  diagnostics: Diagnostics;
  set: TokenSet | undefined;
  /** dist-relative path → content. Empty when there are errors. */
  files: Record<string, string>;
}

/** Pure: reads through `src`, never touches the disk. */
export function buildDesignSystem(src: TokenSource): BuildResult {
  const diagnostics = new Diagnostics();
  const set = loadTokenSet(src, diagnostics);
  if (set) {
    validate(set, diagnostics);
    validateTargetRequirements(set, diagnostics, ECHARTS_REQUIREMENTS);
    validateTypeRoles(set, diagnostics);
  }
  if (!set || diagnostics.errors.length > 0) return { diagnostics, set, files: {} };
  return {
    diagnostics,
    set,
    files: {
      'tokens.css': emitCss(set),
      'echarts-theme.ts': emitEcharts(set),
      'three.ts': emitThree(set),
      'og.ts': emitOg(set),
      'catalog.ts': emitCatalog(set),
    },
  };
}
