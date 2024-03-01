/* eslint-disable @typescript-eslint/no-unused-vars */
import {
	Elysia,
	InternalServerError,
	ParseError,
	ValidationError,
	error,
	t
} from '../../src'
import { describe, expect, it } from 'bun:test'
import { post, req } from '../utils'

describe('error', () => {
	it('use custom 404', async () => {
		const app = new Elysia()
			.get('/', () => 'hello')
			.onError(({ code, set }) => {
				if (code === 'NOT_FOUND') {
					set.status = 404

					return 'UwU'
				}
			})

		const root = await app.handle(req('/')).then((x) => x.text())
		const notFound = await app
			.handle(req('/not/found'))
			.then((x) => x.text())

		expect(root).toBe('hello')
		expect(notFound).toBe('UwU')
	})

	it('handle parse error', async () => {
		const app = new Elysia()
			.onError(({ code }) => {
				if (code === 'PARSE') return 'Why you no proper type'
			})
			.post('/', () => {
				throw new ParseError()
			})

		const root = await app.handle(
			new Request('http://localhost/', {
				method: 'POST',
				body: 'A',
				headers: {
					'content-type': 'application/json'
				}
			})
		)

		expect(await root.text()).toBe('Why you no proper type')
		expect(root.status).toBe(400)
	})

	it('custom validation error', async () => {
		const app = new Elysia()
			.onError(({ code, error, set }) => {
				if (code === 'VALIDATION') {
					set.status = 400

					return error.all.map((i) => ({
						filed: i.path.slice(1) || 'root',
						reason: i.message
					}))
				}
			})
			.post('/login', ({ body }) => body, {
				body: t.Object({
					username: t.String(),
					password: t.String()
				})
			})

		const res = await app.handle(post('/login', {}))
		const data = await res.json()

		// @ts-ignore
		expect(data.length).toBe(4)
		expect(res.status).toBe(400)
	})

	it('custom 500', async () => {
		const app = new Elysia()
			.onError(({ code }) => {
				if (code === 'INTERNAL_SERVER_ERROR') {
					return 'UwU'
				}
			})
			.get('/', () => {
				throw new InternalServerError()
			})

		const response = await app.handle(req('/'))

		expect(await response.text()).toBe('UwU')
		expect(response.status).toBe(500)
	})

	it('error function status', async () => {
		const app = new Elysia().get('/', () => error(418, 'I am a teapot'))

		const response = await app.handle(req('/'))

		expect(response.status).toBe(418)
	})

	it('error function name', async () => {
		const app = new Elysia().get('/', () =>
			error("I'm a teapot", 'I am a teapot')
		)

		const response = await app.handle(req('/'))

		expect(response.status).toBe(418)
	})

	it('as global', async () => {
		const called = <string[]>[]

		const plugin = new Elysia()
			.onError({ as: 'global' }, ({ path }) => {
				called.push(path)

				return {}
			})
			.get('/inner', () => {
				throw new Error('A')
			})

		const app = new Elysia().use(plugin).get('/outer', () => {
			throw new Error('A')
		})

		const res = await Promise.all([
			app.handle(req('/inner')),
			app.handle(req('/outer'))
		])

		expect(called).toEqual(['/inner', '/outer'])
	})

	it('as local', async () => {
		const called = <string[]>[]

		const plugin = new Elysia()
			.onError({ as: 'local' },  ({ path }) => {
				called.push(path)

				return {}
			})
			.get('/inner', () => {
				throw new Error('A')
			})

		const app = new Elysia().use(plugin).get('/outer', () => {
			throw new Error('A')
		})

		const res = await Promise.all([
			app.handle(req('/inner')),
			app.handle(req('/outer'))
		])

		expect(called).toEqual(['/inner'])
	})

	it('support array', async () => {
		let total = 0

		const app = new Elysia()
			.onAfterHandle([
				() => {
					total++
				},
				() => {
					total++
				}
			])
			.get('/', () => 'NOOP')

		const res = await app.handle(req('/'))

		expect(total).toEqual(2)
	})
})
