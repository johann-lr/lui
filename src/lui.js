/*
	@preserve lui.js web frame work
	inspired by react and mithril
	L3P3.de 2020
*/

const DEBUG = true;
const VERBOSE = false;

const HOOK_EFFECT = DEBUG ? 0 : 1;
const HOOK_ASYNC = DEBUG ? 1 : 2;
const HOOK_STATE = DEBUG ? 2 : 0;
const HOOK_STATIC = DEBUG ? 3 : 0;
const HOOK_MEMO = DEBUG ? 4 : 0;
const HOOK_PREV = DEBUG ? 5 : 0;
const HOOK_REDUCEA = DEBUG ? 6 : 0;
const HOOK_REDUCEF = DEBUG ? 7 : 0;


/// COMPILATION ///

/**
	@template {TYPE_PROPS} T
	@typedef {function(T):?Array<?TYPE_INSTANCE_CALL<*>|boolean>}
*/
var TYPE_COMPONENT;

/** @typedef {TYPE_COMPONENT<TYPE_PROPS_HTML>} */
var TYPE_COMPONENT_HTML;

/** @typedef {?string} */
var TYPE_KEY;

/** @typedef {?Object} */
var TYPE_PROPS;

/**
	@typedef {?{
		C: (Array<TYPE_INSTANCE_CALL<*>>|void),
		F: (Object<string, boolean>|void),
		S: (Object<string, string>|void)
	}}
*/
var TYPE_PROPS_HTML;

/** @typedef {[number, ...*]} */
var TYPE_SLOT;

/**
	@template {TYPE_PROPS} T
	@typedef {{
		F: TYPE_COMPONENT<T>,
		P: T
	}}
*/
var TYPE_INSTANCE_CALL;

/**
	@template {TYPE_PROPS} T
	@typedef {{
		A: TYPE_INSTANCE_CALL<T>,
		P: ?TYPE_INSTANCE<*>,
		S: Array<TYPE_SLOT>,
		C: ?Array<TYPE_INSTANCE<*>>,
		D: ?HTMLElement
	}}
*/
var TYPE_INSTANCE;

/** @typedef {Set<TYPE_INSTANCE<*>>} */
var TYPE_QUEUE;


/// STATE ///

/**
	currently rendered instance
	@type {?TYPE_INSTANCE<*>}
*/
let current = null;

/**
	first render call for current instance
	@type {boolean}
*/
let current_first = true;

/**
	next state slot pointer
	@type {number}
*/
let current_index = 0;

/**
	relative time of the last render call
	@type {number}
*/
let render_time = 0;

/**
	instances that should be rerendered in this frame
	@type {TYPE_QUEUE}
*/
let render_queue = new Set;

/**
	instances that should be rerendered in the next frame
	@type {TYPE_QUEUE}
*/
let render_queue_next = new Set;


/// FUNCTIONS ///

DEBUG && (
	window.onerror = () => {
		current && log('error');
	}
);

/**
	gets the current stack
	@return {string}
*/
const stack_get = () => {
	const stack = [];
	let item = current;
	while (item !== null) {
		stack.unshift(
			component_name_get(item.A.F)
		);
		item = item.P;
	}
	return (
		stack.join('>') ||
		'-'
	);
};

/**
	gets the current stack
	@param {TYPE_COMPONENT<*>} component
	@return {string}
*/
const component_name_get = component => (
	component['name_'] ||
	component.name ||
	'?'
);

/**
	throws a lui error
	@param {string} message
	@throws {Error}
*/
const error = message => {
	throw(
		new Error('lui: ' + message)
	);
}

/**
	verbose logging
	@param {string} message
*/
const log = (message, ...data) => {
	console.log('lui ' + stack_get() + ': ' + message, ...data);
}

/**
	lists all changed properties
	@param {!Object} a
	@param {!Object} b
	@return {!Array<string>}
*/
const object_diff = (a, b) => (
	Array.from(
		new Set(
			Object.keys(a)
			.concat(Object.keys(b))
		)
	)
	.filter(key => a[key] !== b[key])
)

/**
	ensures hook rules
	@param {number=} type
*/
const assert_hook = type => {
	current === null &&
		error('hook called outside of component rendering');

	type !== undefined &&
	current_index < current.S.length &&
	current.S[current_index][0] !== type &&
		error('inconsistent hook order at index ' + current_index);
};

/**
	request rerendering for instance
	@param {TYPE_INSTANCE<*>} instance
*/
const dirtify = instance => {
	VERBOSE &&
	!render_queue.has(instance) &&
		log('dirtify ' + component_name_get(instance.A.F));

	render_queue.add(instance);
	//TODO order
}

/**
	request rerendering for current instance
*/
export const hook_rerender = () => {
	DEBUG && assert_hook();

	render_queue_next.add(current);
}

/**
	get if this is the first render call
	@return {boolean}
*/
export const hook_first = () => (
	DEBUG && assert_hook(),
	current_first
);

/**
	update an instance
	@param {TYPE_INSTANCE<*>} instance
*/
const render = instance => {
	const parent = current;

	(
		current_first = (
			current = instance
		).S === null
	) && (
		current.S = []
	);
	current_index = 0;

	VERBOSE && log('render');
	render_queue.delete(instance);

	const child_calls = (instance.A.F)(instance.A.P);

	if (instance.D === null) {
		instance.D = document.createElement('span');//TODO
	}

	if (child_calls !== null) {
		let childs_index = child_calls.length;
		let child_d_last = null;
		let child_call;

		DEBUG &&
		childs_index === 0 &&
			error('returned childs list empty');

		DEBUG &&
		!current_first &&
		childs_index !== instance.C.length &&
			error('returned childs count changed');

		/** @type {Array<TYPE_INSTANCE<*>>} */
		const instance_childs = (
			current_first
			?	(
					instance.C =
						new Array(childs_index).fill(null)
				)
			:	instance.C
		);

		do {
			if (
				(
					child_call = child_calls[--childs_index]
				) &&
				child_call !== true
			) {
				DEBUG &&
				instance_childs[childs_index] &&
				instance_childs[childs_index].A.F !== child_call.F &&
					error('child type changed at ' + childs_index);

				if (instance_childs[childs_index] === null) {
					VERBOSE && log('mount ' + component_name_get(child_call.F));

					render(
						instance_childs[childs_index] = {
							A: child_call,
							P: instance,
							S: null,
							C: null,
							D: null
						}
					);

					instance.D.insertBefore(
						instance_childs[childs_index].D,
						child_d_last
					);
				}
				else if (// TODO
					JSON.stringify(instance_childs[childs_index].A.P) !== JSON.stringify(child_call.P)
				) {
					instance_childs[childs_index].A = child_call;
					render(instance_childs[childs_index]);
				}

				child_d_last = instance_childs[childs_index].D;
			}
			else if (instance_childs[childs_index] !== null) {
				instance.D.removeChild(
					instance_childs[childs_index].D
				);
				unmount(instance_childs[childs_index]);
				instance_childs[childs_index] = null;
			}
		}
		while (childs_index > 0);
	}
	else {
		DEBUG &&
		instance.C !== null &&
			error('no child list returned anymore');
	}

	current = parent;
}

/**
	unmount an instance
	@param {TYPE_INSTANCE<*>} instance
*/
const unmount = instance => {
	VERBOSE && log('unmount ' + component_name_get(instance.A.F));

	const childs = instance.C;
	if (childs) {
		instance.C = null;
		for (const child of childs) {
			unmount(child);
		}
	}

	for (const slot of instance.S) {
		switch (slot[0]) {
			case HOOK_EFFECT:
				slot[2] !== null && slot[2](slot[1]);
				break;
			case HOOK_ASYNC:
				slot[1] = null;
				break;
			default:
		}
	}

	render_queue.delete(instance);
	render_queue_next.delete(instance);
};

/**
	tells if deps are equal
	@param {Array} a
	@param {(Array|undefined)} b
	@return {boolean}
*/
const deps_compare = (a, b) => {
	DEBUG && (
		b
		?	a.length !== b.length
		:	a.length > 0
	) &&
		error('deps length changed');

	if (!b) return true;

	let i = a.length;
	while (i > 0) {
		if (a[--i] === b[i]) continue;
		return false;
	}
	return true;
}

/**
	fire an effect on deps change
	@param {function(...*=):(void|function(...*=):void)} effect
	@param {Array=} deps
*/
export const hook_effect = (effect, deps) => {
	DEBUG && assert_hook(HOOK_EFFECT);

	if (current_index < current.S.length) {
		const slot = current.S[current_index++];
		if (!deps_compare(slot[1], deps)) {
			VERBOSE && log('effect again', deps);
			slot[2] !== null &&
				(slot[2])(
					...slot[1]
				);
			slot[2] = (
				effect(
					...(
						slot[1] = deps || []
					)
				) ||
				null
			);
		}
	}
	else {
		VERBOSE && log('effect initial', deps);
		current.S[current_index++] = [
			HOOK_EFFECT,
			deps = deps || [],
			effect(...deps) || null
		];
	}

	DEBUG &&
	current.S[current_index - 1][2] &&
	current.S[current_index - 1][2].then &&
		error('effect function must be synchronous, use hook_async instead');
}

/**
	request value on deps change
	@template T
	@param {function(...*=):Promise<T>} getter
	@param {Array=} deps
	@param {boolean=} nullify
	@return {?T}
*/
export const hook_async = (getter, deps, nullify) => {
	DEBUG && assert_hook(HOOK_ASYNC);

	const slot = (
		current_index < current.S.length
		?	current.S[current_index++]
		:	(
			current.S[current_index++] = [
				HOOK_ASYNC,
				null,
				null
			]
		)
	);

	if (
		slot[1] !== null &&
		deps_compare(slot[1], deps)
	) {
		return slot[2];
	}

	VERBOSE && log('async start', deps);

	nullify && (
		slot[2] = null
	);

	const current_ = current;
	getter(
		...(
			slot[1] = deps =
				deps || []
		)
	)
	.then(value => {
		VERBOSE && log('async end ' + component_name_get(current_.A.F));
		if (
			slot[1] === deps &&
			slot[2] !== value
		) {
			slot[2] = value;
			dirtify(current_);
		}
	});
	return slot[2];
}

/**
	get persistent state
	@template T
	@param {T} initial
	@return {[T, function(T):void, function():T]}
*/
export const hook_state = initial => {
	DEBUG && assert_hook(HOOK_STATE);

	if (current_index < current.S.length) {
		return current.S[current_index++][1];
	}

	const current_ = current;
	/** @type [T, function(T):void, function():T] */
	const slot = [
		initial,
		value => {
			VERBOSE && log('state set ' + component_name_get(current_.A.F), value);
			if (slot[0] !== value) {
				slot[0] = value;
				dirtify(current_);
			}
		},
		() => slot[0]
	];
	current.S[current_index++] = [HOOK_STATE, slot];
	return slot;
}

/**
	get persistent constant
	@template T
	@param {T} value
	@return {T}
*/
export const hook_static = value => {
	DEBUG && assert_hook(HOOK_STATIC);

	return (
		current_index < current.S.length
		?	current.S[current_index++]
		:	(
			current.S[current_index++] = [HOOK_STATIC, value]
		)
	)[1];
}

/**
	update value on deps change
	@template T
	@param {function(...*=):T} getter
	@param {Array=} deps
	@return {T}
*/
export const hook_memo = (getter, deps) => {
	DEBUG && assert_hook(HOOK_MEMO);

	if (current_index < current.S.length) {
		const slot = current.S[current_index++];
		return (
			deps_compare(slot[1], deps)
			?	slot[2]
			:	(
				VERBOSE && log('memo again', deps),
				slot[2] =
					getter(
						...(
							slot[1] = deps || []
						)
					)
			)
		);
	}

	VERBOSE && log('memo initial', deps);
	const value = getter(
		...(
			deps = deps || []
		)
	);
	current.S[current_index++] = [HOOK_MEMO, deps, value];
	return value;
}

/**
	get value from previous rendering
	@template T
	@param {T} value
	@param {T=} initial
	@return {T}
*/
export const hook_prev = (value, initial) => {
	DEBUG && assert_hook(HOOK_PREV);

	if (current_index < current.S.length) {
		const slot = current.S[current_index++];
		const prev = slot[1];
		slot[1] = value;
		return prev;
	}

	current.S[current_index++] = [HOOK_PREV, value];
	return initial;
}

/**
	used for the hook_delay
	@param {number} delay
	@param {function(boolean):void} expired_set
	@return {function():void}
*/
const hook_delay_effect = (delay, expired_set) => {
	const timeout = setTimeout(
		() => {
			expired_set(true);
		},
		delay
	);

	return (
		() => {
			clearTimeout(timeout);
		}
	);
};

/**
	wait until it turns true
	@param {number} delay in ms
	@return {boolean}
*/
export const hook_delay = delay => {
	const [expired, expired_set] = hook_state(false);
	hook_effect(
		hook_delay_effect,
		[delay, expired_set]
	);
	return expired;
};

/**
	smooth transition
	@param {number} target
	@param {number} delay in ms
	@return {number}
*/
export const hook_transition = (target, delay) => {
	const state = hook_static({value: target});
	const transition = hook_memo(
		(target, delay) => ({
			value_start: state.value,
			value_end: target,
			time_start: render_time,
			time_end: render_time + delay
		}),
		[target, delay]
	);

	if (transition.time_end <= render_time) {
		return (
			state.value = transition.value_end
		);
	}

	hook_rerender();
	return (
		state.value =
		transition.time_start === render_time
		?	transition.value_start
		:	transition.value_start +
			(transition.value_end - transition.value_start) *
			(render_time - transition.time_start) /
			(transition.time_end - transition.time_start)
	);
};

/**
	get all changed properties
	@param {!Object} object
	@return {!Array<string>} keys
*/
export const hook_object_changes = object => (
	object_diff(
		hook_prev(object, null) || {},
		object
	)
);

/**
	get persitent state with custom reducer list
	@template T
	@param {Array<function(T=, ...*=):T>} reducer
	@return {[T, function(number, *):void]}
*/
export const hook_reducer = reducer => {
	DEBUG && assert_hook(HOOK_REDUCEA);

	DEBUG &&
	typeof reducer === 'function' &&
		error('array required, use hook_reducer_f instead');

	if (current_index < current.S.length)
		return current.S[current_index++][1];

	const current_ = current;
	/** @type {[T, function(number, *):void]} */
	const slot = [
		reducer[0](),
		(cmd, payload) => {
			VERBOSE && log('reducer ' + component_name_get(current_.A.F) + ' -> #' + cmd, payload);
			const value = reducer[cmd](slot[0], payload);
			if (slot[0] === value) return;
			slot[0] = value;
			dirtify(current_);
		}
	];
	current.S[current_index++] = [HOOK_REDUCEA, slot];
	return slot;
}

/**
	get persitent state with custom reducer function
	@template T
	@template U
	@param {function(T, U):T} reducer
	@param {function():T=} initializer
	@return {[T, function(U=):void]}
*/
export const hook_reducer_f = (reducer, initializer) => {
	DEBUG && assert_hook(HOOK_REDUCEF);

	DEBUG &&
	typeof reducer !== 'function' &&
		error('function required');

	if (current_index < current.S.length)
		return current.S[current_index++][1];

	const current_ = current;
	/** @type {[T, function(U=):void]} */
	const slot = [
		(
			initializer
			?	initializer()
			:	null
		),
		payload => {
			VERBOSE && log('reducer ' + component_name_get(current_.A.F), payload);
			const value = reducer(slot[0], payload);
			if (slot[0] === value) return;
			slot[0] = value;
			dirtify(current_);
		}
	];
	current.S[current_index++] = [HOOK_REDUCEF, slot];
	return slot;
}

/**
	use a component with props and childs
	@template {TYPE_PROPS} T
	@param {(TYPE_COMPONENT<T>|string)} component
	@param {T=} props
	@param {Array<TYPE_INSTANCE_CALL<*>>=} childs
	@return {TYPE_INSTANCE_CALL<T>}
*/
export const node = (component, props, childs) => {
	DEBUG &&
	childs !== undefined && (
		!childs ||
		childs.constructor !== Array
	) &&
		error('invalid childs type');

	return {
		F: (
			typeof component === 'string'
			?	(
				component_html_cache[component] || (
					component_html_cache[component] =
						component_html_get(component)
				)
			)
			:	component
		),
		P: (
			props
			?	(
					childs
					?	(
							props.C = childs,
							props
						)
					:	props
				)
			:	(
					childs
					?	/** @type {T} */ ({C: childs})
					:	null
				)
		)
	};
}

/**
	create/use a component with props and childs
	@param {!(TYPE_COMPONENT|string)} component
	@param {TYPE_PROPS} props
	@param {!Array} data
	@return {?TYPE_INSTANCE_CALL}
*/
export const node_list = (component, props, data) => {
	DEBUG && error('not implemented yet');
	return null;
}

/**
	mounts the body component
	@param {function():[TYPE_PROPS, Array<TYPE_INSTANCE_CALL>]} body
*/
export const init = body => {
	VERBOSE && log('init');

	DEBUG &&
	(
		current !== null ||
		render_queue.size > 0
	) &&
		error('init called more than once');

	DEBUG &&
	typeof body !== 'function' &&
		error('init function requires body component');

	const dom = document.body;
	dom.innerHTML = '';

	const component_body = () => {
		const [props, childs] = body();
		component_html_generic(props);
		return childs;
	};

	DEBUG && (component_body['name_'] = '$body');

	render({
		A: {
			F: component_body,
			P: null
		},
		P: null,
		S: null,
		C: null,
		D: dom
	});
}

/**
	@dict
	@type {!Object<string, TYPE_COMPONENT_HTML>}
*/
const component_html_cache = {};

/**
	creates a new component for descriptor
	@param {string} code
	@return {TYPE_COMPONENT_HTML}
*/
const component_html_get = code => {
	VERBOSE && log('create html ' + code);

	const index_sqb = code.indexOf('[');
	const index_ht = code.indexOf('#');
	const tag = (
		index_sqb >= 0 && index_ht >= 0
		?	code.substr(0, Math.min(index_sqb, index_ht))
		:	index_sqb < 0 && index_ht < 0
		?	code.substr(0)
		:	code.substr(0, index_sqb < 0 ? index_ht : index_sqb)
	);

	DEBUG && (
		tag.length === 0 ||
		tag !== tag.toLowerCase() ||
		tag.includes(' ')
	) &&
		error('selector: invalid tag');

	DEBUG &&
	index_sqb > 0 &&
	index_ht > 0 &&
	code.lastIndexOf(']') < index_ht &&
	index_ht > index_sqb &&
		error('selector: ID must be at tag');

	const dom = document.createElement(tag);

	if (index_ht >= 1) {
		dom.id = (
			index_sqb < 0
			?	code.substr(index_ht + 1)
			:	code.substring(index_ht + 1, index_sqb)
		);

		DEBUG && (
			!dom.id ||
			dom.id.includes(' ')
		) &&
			error('selector: invalid ID');
	}

	if (index_sqb >= 1) {
		DEBUG &&
		!code.endsWith(']') &&
			error('selector: ] missing');

		for (
			const sqbi of
			code
			.substring(
				index_sqb + 1,
				code.length - 1
			)
			.split('][')
		) {
			DEBUG &&
			!sqbi &&
				error('selector: empty attribute');

			DEBUG &&
			(sqbi.includes('[') || sqbi.includes(']')) &&
				error('selector: attributes screwed up');

			const eqi = sqbi.indexOf('=');

			DEBUG &&
			sqbi.includes(' ') && (
				eqi < 0 ||
				sqbi.indexOf(' ') < eqi
			) &&
				error('selctor: invalid attribute name');

			if (eqi < 0) {
				dom[sqbi] = true;
			}
			else {
				DEBUG &&
				sqbi.substr(0, eqi) === 'id' &&
					error('selector: use tag#ID');

				dom[
					sqbi.substr(0, eqi)
				] =
					sqbi.substr(eqi + 1);
			}
		}
	}

	/** @type {TYPE_COMPONENT_HTML} */
	const component = props => {
		if (current.D === null)
			current.D = /** @type {HTMLElement} */ (dom.cloneNode(true));
		return component_html_generic(props);
	}

	DEBUG && (component['name_'] = '$' + code);

	return component;
}

/**
	html component base
	@type {TYPE_COMPONENT_HTML}
*/
const component_html_generic = props => {
	if (props === null) {
		return null;
	}

	const dom = current.D;

	for (const key of hook_object_changes(props)) {
		switch (key.charCodeAt(0)) {
			case 70://F
				DEBUG &&
				key.length > 1 &&
					error('capital prop: ' + key);

				dom.className = (
					Object.entries(props.F)
					.filter(([, value]) => value)
					.map(([key]) => key)
					.join(' ')
				);

				VERBOSE && log('html flags', dom.className.split(' '));

				if (DEBUG) continue;
			case 67://C
			case 83://S
				DEBUG &&
				key.length > 1 &&
					error('capital prop: ' + key);

				continue;
			default:
				DEBUG &&
				key.charCodeAt(0) < 97 &&
					error('invalid prop: ' + key);

				VERBOSE && log('html prop ' + key, props[key]);

				dom[key] = props[key];
		}
	}

	if (props.S)
		for (const key of hook_object_changes(props.S)) {
			VERBOSE && log('html css ' + key + '=' + props.S[key]);
			dom.style[key] = props.S[key];
		}

	return props.C || null;
}

/**
	update dirty instances
	@param {number} time
*/
const loop = time => {
	DEBUG &&
	current !== null &&
		error('rendering incomplete');

	if (render_queue.size > 0) {
		render_time = time;

		let rerenders = 0;
		do {
			DEBUG &&
			++rerenders > 5 &&
				error('too many rerenders');

			for (const instance of render_queue) {
				render_queue.has(instance) &&
					render(instance);
			}
		}
		while (render_queue.size > 0);

		//swap queues and clear the next one
		const tmp = render_queue;
		render_queue = render_queue_next;
		(
			render_queue_next = tmp
		).clear();
	}

	requestAnimationFrame(loop);
}
loop(0);
