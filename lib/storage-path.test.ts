import { describe, it, expect } from 'vitest'
import { ownedThumbnailPath } from './storage-path'

const SB = 'https://abcdefgh.supabase.co'
const OWNER = '11111111-2222-3333-4444-555555555555'
const OTHER = '99999999-8888-7777-6666-555555555555'

describe('ownedThumbnailPath', () => {
  it('自分のフォルダ配下の正規URLならキーを返す', () => {
    expect(ownedThumbnailPath(`${SB}/storage/v1/object/public/thumbnails/${OWNER}/1725000000_ab12.jpg`, OWNER, SB))
      .toBe(`${OWNER}/1725000000_ab12.jpg`)
  })

  it('クエリ文字列付きでも同じキーを返す', () => {
    expect(ownedThumbnailPath(`${SB}/storage/v1/object/public/thumbnails/${OWNER}/a.png?t=1`, OWNER, SB))
      .toBe(`${OWNER}/a.png`)
  })

  it('URLエンコードされたキーはデコードして返す', () => {
    expect(ownedThumbnailPath(`${SB}/storage/v1/object/public/thumbnails/${OWNER}/%E3%82%B5%E3%83%A0.jpg`, OWNER, SB))
      .toBe(`${OWNER}/サム.jpg`)
  })

  it('他人のフォルダを指していたら null（クロステナント削除の防止）', () => {
    expect(ownedThumbnailPath(`${SB}/storage/v1/object/public/thumbnails/${OTHER}/x.jpg`, OWNER, SB)).toBeNull()
  })

  it('別ホストなら null', () => {
    expect(ownedThumbnailPath(`https://evil.example.com/storage/v1/object/public/thumbnails/${OWNER}/x.jpg`, OWNER, SB)).toBeNull()
  })

  it('別バケットなら null', () => {
    expect(ownedThumbnailPath(`${SB}/storage/v1/object/public/contents/${OWNER}/x.jpg`, OWNER, SB)).toBeNull()
  })

  it('パストラバーサル（..）や空セグメントは null', () => {
    expect(ownedThumbnailPath(`${SB}/storage/v1/object/public/thumbnails/${OWNER}/../${OTHER}/x.jpg`, OWNER, SB)).toBeNull()
    expect(ownedThumbnailPath(`${SB}/storage/v1/object/public/thumbnails/${OWNER}//x.jpg`, OWNER, SB)).toBeNull()
    expect(ownedThumbnailPath(`${SB}/storage/v1/object/public/thumbnails/${OWNER}/%2e%2e/x.jpg`, OWNER, SB)).toBeNull()
  })

  it('owner_id の前方一致だけでは通らない（"<owner>-evil/..." 等）', () => {
    expect(ownedThumbnailPath(`${SB}/storage/v1/object/public/thumbnails/${OWNER}-evil/x.jpg`, OWNER, SB)).toBeNull()
  })

  it('URL や owner や supabaseUrl が無ければ null', () => {
    expect(ownedThumbnailPath(null, OWNER, SB)).toBeNull()
    expect(ownedThumbnailPath(`${SB}/storage/v1/object/public/thumbnails/${OWNER}/x.jpg`, '', SB)).toBeNull()
    expect(ownedThumbnailPath(`${SB}/storage/v1/object/public/thumbnails/${OWNER}/x.jpg`, OWNER, undefined)).toBeNull()
    expect(ownedThumbnailPath('not a url', OWNER, SB)).toBeNull()
  })
})
