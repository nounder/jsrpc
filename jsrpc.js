function JSRPC({
	listener = JSRPC.listener,
	sender = JSRPC.sender,
	methods = [],
	readyNotification = "__JSRPC_READY__",
} = {}) {
	let rpcId = 0
	let rpcFutures = {}
	let rpcReadyFuture = {}

	const readyPromise = new Promise((resolve, reject) => {
		rpcReadyFuture.resolve = resolve
		rpcReadyFuture.reject = reject
	})

	rpcReadyFuture.promise = readyPromise

	if (!listener || !sender) {
		throw new Error("JSRPC listener and sender are required")
	}

	listener(handleMessage)

	if (readyNotification) {
		sender({
			jsonrpc: "2.0",
			method: readyNotification,
		})
	}

	function handleResponseMessage({ id, error, result }) {
		if (id !== undefined) {
			const cb = rpcFutures[id]

			if (cb) {
				if (error) {
					cb.reject(error)
				} else {
					cb.resolve(result)
				}

				delete rpcFutures[id]
			}
		}
	}

	function handleRequestMessage({ id, method, params }) {
		if (id === undefined && method === readyNotification) {
			rpcReadyFuture.resolve()

			return
		}

		const callable = methods[method]

		if (callable) {
			;(async () => {
				try {
					const result = await callable(params)

					if (id !== undefined) {
						sender({
							jsonrpc: "2.0",
							id,
							result: result === undefined ? null : result,
						})
					}
				} catch (error) {
					if (id !== undefined) {
						sender({
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
			sender({
				jsonrpc: "2.0",
				id,
				error: {
					code: -32601,
					message: "Method not found",
					data: {
						method,
					},
				},
			})
		}
	}

	function handleMessage({ id, method, params = {}, result, error }) {
		if (result !== undefined || error !== undefined) {
			handleResponseMessage({ id, error, result })
		} else if (method) {
			handleRequestMessage({ id, method, params })
		}
	}

	async function rpc(method, params = {}) {
		await rpcReadyFuture.promise

		const id = rpcId++
		const rpcReqest = {
			jsonrpc: "2.0",
			id,
			method,
			params,
		}

		const promise = new Promise((resolve, reject) => {
			rpcFutures[id] = { promise: null, resolve, reject }
		})
		rpcFutures[id].promise = promise

		sender(rpcReqest)

		return await promise
	}

	rpc.ready = rpcReadyFuture.promise

	return rpc
}

export default JSRPC
