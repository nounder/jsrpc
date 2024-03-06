class JSRPC {
	constructor() {
		this._rpcId = 0
		this._rpcFutures = {}

		const readyPromise = new Promise((resolve, reject) => {
			this._readyFuture = {
				/** @type {Promise<void>} */
				promise: null,
				resolve,
				reject,
			}
		})
		this._readyFuture.promise = readyPromise

		this._rpcListen()

		this._rpcSend({
			jsonrpc: "2.0",
			method: "_rpc_ready",
		})
	}

	_rpcListen() {
		throw new Error("Not implemented")
	}

	_rpcSend() {
		throw new Error("Not implemented")
	}

	/** @return {Promise<any>} */
	async call(method, params = {}) {
		await this._readyFuture.promise

		const id = this._rpcId++
		const rpcReqest = {
			jsonrpc: "2.0",
			id,
			method,
			params,
		}

		const promise = new Promise((resolve, reject) => {
			this._rpcFutures[id] = { promise: null, resolve, reject }
		})
		this._rpcFutures[id].promise = promise

		this._rpcSend(rpcReqest)

		return await promise
	}

	_rpcHandle({ id, method, params = {}, result, error }) {
		/**
		 * Handle a response
		 * Ignore responses without id
		 */
		if (result !== undefined || error !== undefined) {
			if (id !== undefined) {
				const cb = this._rpcFutures[id]

				if (cb) {
					if (error) {
						cb.reject(error)
					} else {
						cb.resolve(result)
					}

					delete this._rpcFutures[id]
				}
			}

			return
		}

		/*
		 * Hande a request or a notification
		 */
		if (method) {
			if (id === undefined && method === "_rpc_ready") {
				this._readyFuture.resolve()

				return
			}

			const callable = this[method]

			if (callable) {
				;(async () => {
					try {
						const result = await callable(params)

						if (id !== undefined) {
							this._rpcSend({
								jsonrpc: "2.0",
								id,
								result: result === undefined ? null : result,
							})
						}
					} catch (error) {
						if (id !== undefined) {
							this._rpcSend({
								jsonrpc: "2.0",
								id,
								error: {
									code: -32000,
									message: error.message,
								},
							})
						}
					}
				})()
			} else {
				this._rpcSend({
					jsonrpc: "2.0",
					id,
					error: {
						code: -32601,
						message: "Method not found",
					},
				})
			}

			return
		}
	}
}
