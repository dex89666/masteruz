import { describe, it, expect } from 'vitest';
import { searchVariants } from '../../src/utils/translit.js';

describe('searchVariants: имя в любом написании', () => {
  it('кириллица → латиница', () => {
    expect(searchVariants('Марина')).toContain('marina');
    expect(searchVariants('Хасан')).toEqual(expect.arrayContaining(['khasan', 'hasan', 'xasan']));
    expect(searchVariants('Жасур')).toEqual(expect.arrayContaining(['zhasur', 'jasur']));
    expect(searchVariants('Шахзод')).toEqual(expect.arrayContaining(['shakhzod', 'shahzod', 'shaxzod']));
  });

  it('латиница → кириллица', () => {
    expect(searchVariants('Marina')).toContain('марина');
    expect(searchVariants('Shahzod')).toContain('шахзод');
    expect(searchVariants('Yuliya')).toContain('юлия');
    expect(searchVariants("O'tkir")).toContain('ўткир');
  });

  it('исходное слово всегда в списке, пустое — пусто', () => {
    expect(searchVariants('Vladimir')[0]).toBe('vladimir');
    expect(searchVariants('  ')).toEqual([]);
  });
});
