export default {
	async fetch(request, env) {
		if (!env.SUBV2KV) {
			return errorToResponse("SUBV2KVNotFound: Not Found SUBV2KV Bind");
		}
		if (!env.APIKEYSECRET) {
			return errorToResponse("APIKEYSECRETNotFound: Not Found APIKEYSECRET Bind");
		}

		const APIKEY = env.APIKEYSECRET;

		// first check if the request is authorized
		const { headers } = request;
		const urlObj = new URL(request.url);
		const authorization = headers.get("Authorization");
		const headerAuthorizationValue = `Bearer ${APIKEY}`;
		let authorization_ok = true;
		if (authorization) {
			if (authorization !== headerAuthorizationValue) {
				// if not authorized, return 401
				authorization_ok = false;
			}
		} else if (urlObj.searchParams.has("key")) {
			const keyFromQuery = urlObj.searchParams.get("key");
			if (keyFromQuery !== APIKEY) {
				authorization_ok = false;
			}
		} else {
			authorization_ok = false;
		}

		if (!authorization_ok) {
			return errorToResponse("Authrorization Bearer abc or search query key=abc is required");
		}




		try {
			const response = await handleRequest(request, env);
			return response;
		} catch (e) {
			return errorToResponse(e);
		}
	},
};

export class HTTPError extends Error {
	constructor(name, message, status, statusText) {
		super(message);
		this.name = name;
		this.status = status;
		this.statusText = statusText;
	}
}
export function errorToResponse(error) {
	const bodyJson = {
		ok: false,
		error: "Internal Server Error",
		message: "Internal Server Error",
	};
	let status = 500;
	let statusText = "Internal Server Error";

	if (error instanceof Error) {
		bodyJson.message = error.message;
		bodyJson.error = error.name;

		if (error.status) {
			status = error.status;
		}
		if (error.statusText) {
			statusText = error.statusText;
		}
	} else {
		bodyJson.message = error;
		bodyJson.error = error;
	}
	return new Response(JSON.stringify(bodyJson, null, 2), {
		status: status,
		statusText: statusText,
		headers: {
			"Content-Type": "application/json",
		},
	});
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetch_text(url) {
	const new_req = new Request(url);
	const resp = await fetch(new_req);

	const text = await resp.text();
	return text;
}

async function handleRequest(request, env) {
	const url = new URL(request.url);
	console.log(`Hello ${navigator.userAgent} at path ${url.pathname}!`);


	const fetch_sub = url.pathname.startsWith("/sub");
	const fetch_sub_clean = url.pathname.startsWith("/sub/clean");

	if (fetch_sub) {
		const allowParam = url.searchParams.has("allow") ? url.searchParams.get("allow") : undefined;
		const blockParam = url.searchParams.has("block") ? url.searchParams.get("block") : fetch_sub_clean ? "HK,RU" : undefined;
		const blockParamList = blockParam ? blockParam.split(",") : [];
		const allowParamList = allowParam ? allowParam.split(",") : [];
		const batch = url.searchParams.has("batch") ? Number(url.searchParams.get("batch")) : 1;


		function proxy_filter(entry) {
			var is_allowed = allowParam ? undefined : true;

			allowParamList.forEach(function (e) {
				if (is_allowed === undefined) {
					is_allowed = entry.includes(e)
				} else {
					is_allowed = is_allowed || entry.includes(e)
				}
			});


			var is_blocked = false;
			blockParamList.forEach(function (e) {
				is_blocked = is_blocked || entry.includes(e)
			});
			return is_allowed && !is_blocked;
		}



		// const new_req = new Request("https://github.com/wzdnzd/aggregator/issues/91");
		// const resp = await fetch(new_req);

		var response_text = "";


		try {
			const text = await fetch_text("https://github.com/wzdnzd/aggregator/issues/91");
			// console.log(`text : ${text}`);

						
			const match = text.match(/\|\s*token\s*\|[^|]*\|[^|]*\|[^|]*\|[^|]*\|\s*`([a-z0-9]+)`/);

			const extractedToken = match?.[1];
			
			// console.log(`extractedToken : ${extractedToken}`);


			const urlRegex = /在线服务接口地址\*\*\S(https:\/\/[0-9a-z\.\-\>\&\/\?\=\\]+)/;
			const urlMatch = text.match(urlRegex);
			var modifiedUrl = "";
			console.log(`urlMatch[0] : ${urlMatch[0]}`);

			console.log(`urlMatch[1] : ${urlMatch[1]}`);


			if (urlMatch) {
				const extractedUrl = urlMatch[1];
				console.log(`extractedUrl : ${extractedUrl}`);
				modifiedUrl = extractedUrl.replace("token=xxx", `token=${extractedToken}`);
				modifiedUrl = modifiedUrl.replace("target=xxx", `target=v2ray`);
				modifiedUrl = modifiedUrl.replace("list=xxx", `list=0`);
				//modifiedUrl = modifiedUrl.replace("\\u0026", ``);
				modifiedUrl = modifiedUrl
					.replace(/\\u0026/g, '&') // Replace \u0026 with &
					.replace(/\\n/g, '');     // Remove \n

			}
			console.log(`modifiedUrl : ${modifiedUrl}`);

			const sub_req = new Request(modifiedUrl);
			// const sub_resp_1 = await fetch(sub_req);
			// const sub_resp_2 = await fetch(sub_req);

			// const sub_text_1 = await sub_resp_1.text();
			// const sub_text_2 = await sub_resp_2.text();
			// const sub_text = sub_text_1.concat(sub_text_2);

			let  sub_text_all = "";
			for (var i = 0 ; i<batch;i++){
				const sub_resp = await fetch(sub_req);
				const text = await sub_resp.text();
				sub_text_all = sub_text_all.concat(text);
				await sleep(500);
			}

			const plain_text = atob(sub_text_all);
			// console.log(plain_text);
			const decodedString = decodeURIComponent(plain_text);
			console.log(decodedString);
			const proxy_lists = decodedString.split("\n");
			const clean_proxy_list = proxy_lists.filter(function (e) { return proxy_filter(e) });
			const encode_clean_proxy = clean_proxy_list.map(function (e) { return encodeURI(e) }).join("\n");
			//https://stackoverflow.com/questions/332872/encode-url-in-javascript
			// const encode_clean_proxy =  encodeURI(clean_proxy)
			// .replace(/%3A/g, ':')  // Replaces %3A with :
			// .replace(/%2F/g, '/')  // Replaces %2F with /
			// .replace(/%23/g, '#') // Replaces %23 with #
			// .replace(/%40/g, '@') // Replaces %40 with @
			;



			const encode_json = btoa(encode_clean_proxy);






			response_text = decodedString;
			response_text = encode_json;
			await env.SUBV2KV.put("sub_data", response_text);

		} catch (error) {
			response_text = await env.SUBV2KV.get("sub_data");
			if (response_text === null) {
				return new Response(`Fetch error ${error}, and fail to get from KV`, { status: 404 });
			}
		}

		return new Response(response_text, {
			headers: {
				"content-type": "text/json",
			},
		});
	}
	return new Response("Hello!", {
		headers: {
			"content-type": "text/html",
		},
	});
}
