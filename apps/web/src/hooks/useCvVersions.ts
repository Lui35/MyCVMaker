import { useCallback, useState } from 'react'
import { apiJson } from '../api/client'
import type { ApiCVRecord, CVPayload, CVVersionSummary } from '../types'

export const useCvVersions = () => {
  const [versions, setVersions] = useState<CVVersionSummary[]>([])

  const refresh = useCallback(async () => {
    const list = await apiJson<CVVersionSummary[]>('/cvs', {}, 'Could not load CV versions.')
    setVersions(list)
    return list
  }, [])

  const load = useCallback(
    (cvId: string) => apiJson<ApiCVRecord>(`/cvs/${cvId}`, {}, 'Could not load the selected CV.'),
    [],
  )

  const save = useCallback(async (payload: CVPayload, cvId?: string | null) => {
    const result = await apiJson<{ id: string }>(
      cvId ? `/cvs/${cvId}` : '/cvs',
      { method: cvId ? 'PUT' : 'POST', body: JSON.stringify(payload) },
      'Could not save the CV version.',
    )
    await refresh()
    return result
  }, [refresh])

  const duplicate = useCallback(async (cvId: string) => {
    const result = await apiJson<{ id: string }>(
      `/cvs/${cvId}/duplicate`,
      { method: 'POST' },
      'Could not duplicate the CV version.',
    )
    await refresh()
    return result
  }, [refresh])

  const setDefault = useCallback(async (cvId: string) => {
    await apiJson(`/cvs/${cvId}/set-default`, { method: 'POST' }, 'Could not set the default CV.')
    await refresh()
  }, [refresh])

  const remove = useCallback(async (cvId: string) => {
    await apiJson(`/cvs/${cvId}`, { method: 'DELETE' }, 'Could not delete the CV version.')
    return refresh()
  }, [refresh])

  return { versions, refresh, load, save, duplicate, setDefault, remove }
}
