import { describe, it, expect } from 'vitest'
import {
  buildRowOrderAfterMove,
  moveRowValues,
  deleteRowValues,
  insertRowValues,
} from '@/utils/rowValueShift'

/**
 * 通り列・カスタム列の値は「列ID:行番号」で持っている。
 * 行を動かしたり消したりしたときに、値が行に付いてこないという指摘があった。
 * ここでは「行をこう動かしたら値はこうなる」という約束だけを固める。
 */

const m = (o: Record<string, string>) => new Map(Object.entries(o))
const o = (map: Map<string, string>) => Object.fromEntries([...map].sort())

describe('buildRowOrderAfterMove — 行を挿入方式で動かしたときの新しい並び', () => {
  it('上の行を下へ動かすと、間の行が1つずつ繰り上がる', () => {
    // 0 を 2 の位置へ → 新しい並びは [1, 2, 0, 3]
    expect(buildRowOrderAfterMove(4, 0, 2)).toEqual([1, 2, 0, 3])
  })

  it('下の行を上へ動かすと、間の行が1つずつ繰り下がる', () => {
    // 3 を 1 の位置へ → 新しい並びは [0, 3, 1, 2]
    expect(buildRowOrderAfterMove(4, 3, 1)).toEqual([0, 3, 1, 2])
  })

  it('同じ位置なら並びは変わらない', () => {
    expect(buildRowOrderAfterMove(3, 1, 1)).toEqual([0, 1, 2])
  })
})

describe('moveRowValues — 行を動かすと値も付いてくる', () => {
  it('上の行を下へ動かすと、値も一緒に動く', () => {
    const before = m({ 'c1:0': 'A', 'c1:1': 'B', 'c1:2': 'C' })
    expect(o(moveRowValues(before, 0, 2))).toEqual({
      'c1:0': 'B',
      'c1:1': 'C',
      'c1:2': 'A',
    })
  })

  it('下の行を上へ動かしても、値も一緒に動く', () => {
    const before = m({ 'c1:0': 'A', 'c1:1': 'B', 'c1:2': 'C' })
    expect(o(moveRowValues(before, 2, 0))).toEqual({
      'c1:0': 'C',
      'c1:1': 'A',
      'c1:2': 'B',
    })
  })

  it('動かした範囲の外にある行は、そのまま残る', () => {
    const before = m({ 'c1:0': 'A', 'c1:1': 'B', 'c1:2': 'C', 'c1:5': 'Z' })
    expect(o(moveRowValues(before, 0, 1))['c1:5']).toBe('Z')
  })

  it('列が複数あっても、それぞれ独立に動く', () => {
    const before = m({ 'c1:0': 'A', 'c1:1': 'B', 'c2:0': 'X', 'c2:1': 'Y' })
    expect(o(moveRowValues(before, 0, 1))).toEqual({
      'c1:0': 'B',
      'c1:1': 'A',
      'c2:0': 'Y',
      'c2:1': 'X',
    })
  })

  it('空欄の行をまたいでも、行の対応はずれない', () => {
    // 1行目は空欄（キーなし）。0 を 2 へ動かす
    const before = m({ 'c1:0': 'A', 'c1:2': 'C' })
    expect(o(moveRowValues(before, 0, 2))).toEqual({
      'c1:1': 'C',
      'c1:2': 'A',
    })
  })
})

describe('deleteRowValues — 行を消すと値も消えて、下の行が繰り上がる', () => {
  it('消した行の値は残らない', () => {
    const before = m({ 'c1:0': 'A', 'c1:1': 'B', 'c1:2': 'C' })
    expect(o(deleteRowValues(before, 1))).toEqual({ 'c1:0': 'A', 'c1:1': 'C' })
  })

  it('最後の行を消しても、ほかの行は動かない', () => {
    const before = m({ 'c1:0': 'A', 'c1:1': 'B' })
    expect(o(deleteRowValues(before, 1))).toEqual({ 'c1:0': 'A' })
  })

  it('列が複数あっても、それぞれの行が消える', () => {
    const before = m({ 'c1:0': 'A', 'c1:1': 'B', 'c2:0': 'X', 'c2:1': 'Y' })
    expect(o(deleteRowValues(before, 0))).toEqual({ 'c1:0': 'B', 'c2:0': 'Y' })
  })
})

describe('insertRowValues — 行を挿入すると下の行が繰り下がる', () => {
  it('挿入した位置は空欄になり、下の行の値が1つ下へずれる', () => {
    const before = m({ 'c1:0': 'A', 'c1:1': 'B', 'c1:2': 'C' })
    expect(o(insertRowValues(before, 1))).toEqual({
      'c1:0': 'A',
      'c1:2': 'B',
      'c1:3': 'C',
    })
  })

  it('先頭に挿入すると全部が1つ下へずれる', () => {
    const before = m({ 'c1:0': 'A', 'c1:1': 'B' })
    expect(o(insertRowValues(before, 0))).toEqual({ 'c1:1': 'A', 'c1:2': 'B' })
  })
})
