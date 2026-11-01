'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import * as z from 'zod'
import { Avatar } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { ErrorState } from '@/components/ui/error-state'
import { Field, Input } from '@/components/ui/field'
import { NumberField } from '@/components/ui/number-field'
import { Select } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { toast } from '@/components/ui/toast'
import { NICKNAME_MAX, UpdateProfileSchema, type Gender, type Me } from '@/features/me/schemas'
import { errorMessage, isApiError, useQuery } from '@/lib/api'
import { meQuery, useUpdateProfile } from '@/lib/api/queries/me'
import { birthYearOptions, GENDER_OPTIONS, timeZoneOptions } from '../units'
import { AvatarPicker } from './avatar-picker'

/*
 * 个人资料（/me/profile，PRD 2.11）：昵称、头像、性别、出生年份、身高、时区。
 * 体重不在这里：体重按天记录，走打卡弹层的"体重"行（D3）。
 */

type Errors = Record<string, string | undefined>

export function ProfileScreen({ thisYear }: { thisYear: number }) {
  const { data: me, isPending, isError, error, refetch, isRefetching } = useQuery(meQuery())
  if (isPending) {
    return (
      <div role="status" aria-label="加载中" className="grid gap-4">
        <Skeleton className="h-72 w-full rounded-2xl" />
        <Skeleton className="h-56 w-full rounded-2xl" />
      </div>
    )
  }
  if (isError || !me) {
    return (
      <ErrorState
        title="没能加载资料"
        message={isApiError(error) ? errorMessage(error) : undefined}
        onRetry={() => void refetch()}
        retrying={isRefetching}
      />
    )
  }
  // key：资料换了（例如另一个标签页改过）就用新值重置表单
  return <ProfileForm key={me.profile.timeZone + me.profile.nickname} me={me} thisYear={thisYear} />
}

function ProfileForm({ me, thisYear }: { me: Me; thisYear: number }) {
  const router = useRouter()
  const save = useUpdateProfile()
  const p = me.profile
  const [nickname, setNickname] = useState(p.nickname ?? '')
  const [avatar, setAvatar] = useState<string | null>(p.avatar)
  const [gender, setGender] = useState<Gender | null>(p.gender)
  const [birthYear, setBirthYear] = useState<number | null>(p.birthYear)
  const [heightCm, setHeightCm] = useState<number | null>(p.heightCm)
  const [timeZone, setTimeZone] = useState(p.timeZone)
  const [errors, setErrors] = useState<Errors>({})

  function submit(e: React.FormEvent) {
    e.preventDefault()
    const r = UpdateProfileSchema.safeParse({
      nickname,
      avatar,
      gender,
      birthYear,
      heightCm,
      timeZone,
    })
    if (!r.success) {
      const f = z.flattenError(r.error).fieldErrors as Record<string, string[] | undefined>
      return setErrors(Object.fromEntries(Object.entries(f).map(([k, v]) => [k, v?.[0]])))
    }
    setErrors({})
    save.mutate(r.data, {
      onSuccess: () => {
        toast.success('资料已保存')
        router.push('/me')
      },
      onError: (err) => {
        if (isApiError(err) && err.fields) {
          return setErrors(
            Object.fromEntries(Object.entries(err.fields).map(([k, v]) => [k, v[0]])),
          )
        }
        toast.error(isApiError(err) ? errorMessage(err) : '网络好像不太稳，稍后再试试')
      },
    })
  }

  return (
    <form onSubmit={submit} className="grid gap-4 pb-6 @xl:grid-cols-2 @xl:items-start">
      <Card className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <Avatar name={nickname || '新朋友'} avatar={avatar} size="lg" />
          <div className="min-w-0">
            <p className="text-subhead font-bold">头像</p>
            <p className="text-caption text-muted">不选就显示昵称首字</p>
          </div>
          {avatar && (
            <Button variant="ghost" size="sm" className="ml-auto" onClick={() => setAvatar(null)}>
              不用头像
            </Button>
          )}
        </div>
        <AvatarPicker value={avatar} onValueChange={setAvatar} />
      </Card>

      <Card className="flex flex-col gap-4">
        <Field
          label="昵称"
          htmlFor="pf-nickname"
          aside={`${[...nickname.trim()].length} / ${NICKNAME_MAX}`}
          error={errors.nickname}
        >
          <Input
            id="pf-nickname"
            value={nickname}
            autoComplete="nickname"
            aria-invalid={errors.nickname ? true : undefined}
            onChange={(e) => setNickname(e.target.value)}
          />
        </Field>
        <Field label="性别" htmlFor="pf-gender" aside="可选">
          <Select
            id="pf-gender"
            options={GENDER_OPTIONS}
            value={gender}
            onValueChange={setGender}
            placeholder="不填"
          />
        </Field>
        <Field label="出生年份" htmlFor="pf-birth" aside="可选" error={errors.birthYear}>
          <Select
            id="pf-birth"
            options={birthYearOptions(thisYear)}
            value={birthYear === null ? null : String(birthYear)}
            onValueChange={(v) => setBirthYear(Number(v))}
            placeholder="不填"
          />
        </Field>
        <Field label="身高" htmlFor="pf-height" aside="可选" error={errors.heightCm}>
          <NumberField
            id="pf-height"
            value={heightCm}
            onValueChange={(v) => setHeightCm(v === null ? null : Math.round(v))}
            min={80}
            max={250}
            unit="cm"
          />
        </Field>
        <Field
          label="时区"
          htmlFor="pf-tz"
          hint="改时区只影响之后的打卡，以前的记录不变"
          error={errors.timeZone}
        >
          <Select
            id="pf-tz"
            options={timeZoneOptions(timeZone)}
            value={timeZone}
            onValueChange={setTimeZone}
          />
        </Field>
        <Button type="submit" className="w-full" loading={save.isPending}>
          保存
        </Button>
      </Card>
    </form>
  )
}
