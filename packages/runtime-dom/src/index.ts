import {
  type App,
  type CreateAppFunction,
  DeprecationTypes,
  type ElementNamespace,
  type HydrationRenderer,
  type Renderer,
  type RootHydrateFunction,
  type RootRenderFunction,
  compatUtils,
  createHydrationRenderer,
  createRenderer,
  isRuntimeOnly,
  warn,
} from '@vue/runtime-core'
import { nodeOps } from './nodeOps'
import { patchProp } from './patchProp'
// Importing from the compiler, will be tree-shaken in prod
import {
  NOOP,
  extend,
  isFunction,
  isHTMLTag,
  isMathMLTag,
  isSVGTag,
  isString,
} from '@vue/shared'

declare module '@vue/reactivity' {
  export interface RefUnwrapBailTypes {
    runtimeDOMBailTypes: Node | Window
  }
}

const rendererOptions = /*#__PURE__*/ extend({ patchProp }, nodeOps)

// lazy create the renderer - this makes core renderer logic tree-shakable
// in case the user only imports reactivity utilities from Vue.
// 翻译: 延迟创建渲染器 - 这使得核心渲染器逻辑可以被摇树
let renderer: Renderer<Element | ShadowRoot> | HydrationRenderer

let enabledHydration = false

//? 这个 ensureRenderer 函数的目的是确保 renderer 已经被创建。
//? 如果 renderer 已经存在，那么它将直接返回 renderer。
//? 如果 renderer 不存在，那么它将创建一个新的 renderer 并返回。
//? 这里的 renderer 是一个全局变量，它可能在函数外部被定义和初始化。
//? createRenderer<Node, Element | ShadowRoot>(rendererOptions) 是创建 renderer 的函数，
//? 其中 Node, Element | ShadowRoot 是类型参数，rendererOptions 是创建 renderer 时需要的选项。
//?
//? 这个函数使用了 JavaScript 的逻辑或运算符 ||，
//? 如果 renderer 是 null 或 undefined，那么它将执行右边的表达式 (renderer = createRenderer<Node, Element | ShadowRoot>(rendererOptions))，
//? 并将结果赋值给 renderer。
function ensureRenderer() {
  return (
    renderer ||
    (renderer = createRenderer<Node, Element | ShadowRoot>(rendererOptions))
  )
}

function ensureHydrationRenderer() {
  renderer = enabledHydration
    ? renderer
    : createHydrationRenderer(rendererOptions)
  enabledHydration = true
  return renderer as HydrationRenderer
}

// use explicit type casts here to avoid import() calls in rolled-up d.ts
// 翻译: 在这里使用显式类型转换以避免在卷起的 d.ts 中调用 import()
export const render = ((...args) => {
  ensureRenderer().render(...args)
}) as RootRenderFunction<Element | ShadowRoot>

export const hydrate = ((...args) => {
  ensureHydrationRenderer().hydrate(...args)
}) as RootHydrateFunction

//? 这段代码定义了一个 `createApp` 函数，这个函数接收任意数量的参数，并返回一个 `app` 对象。
//? 这个 `app` 对象有一个 `mount` 方法，用于将应用挂载到一个容器元素上。

//? 1. 首先，使用 `ensureRenderer().createApp(...args)` 创建一个 `app` 对象。
//? 如果当前是开发环境（`__DEV__` 为 `true`），那么会调用 `injectNativeTagCheck(app)` 和 `injectCompilerOptionsCheck(app)` 对 `app` 进行一些检查。

//? 2. 然后，重写 `app` 的 `mount` 方法。
//? 这个方法接收一个 `containerOrSelector` 参数，这个参数可以是一个元素、一个 `ShadowRoot`，或者一个 CSS 选择器。
//? 首先，使用 `normalizeContainer(containerOrSelector)` 将 `containerOrSelector` 标准化为一个元素。
//? 如果 `container` 不存在，那么直接返回。
//?
//? 3. 如果 `app._component` 不是一个函数，并且它没有 `render` 方法和 `template` 属性，
//? 那么将 `container` 的 `innerHTML` 赋值给 `component.template`。
//? 这是因为 `app._component` 可能是一个对象，它的 `template` 属性用于存储模板字符串。然后，如果当前是兼容模式和开发环境，
//? 那么会检查 `container` 的所有属性，如果有任何一个属性的名称以 `v-`、`:` 或 `@` 开头，那么显示一个弃用警告。
//?
//? 4. 清空 `container` 的 `innerHTML`，然后调用原始的 `mount` 方法将应用挂载到 `container` 上。
//? 如果 `container` 是一个元素，那么移除它的 `v-cloak` 属性，并添加一个 `data-v-app` 属性。
//?
//? 5. 最后，返回 `app` 对象。这个对象现在有一个新的 `mount` 方法，
//? 这个方法可以将应用挂载到一个元素、一个 `ShadowRoot`，或者一个 CSS 选择器指定的元素上。
export const createApp = ((...args) => {
  const app = ensureRenderer().createApp(...args)

  if (__DEV__) {
    injectNativeTagCheck(app)
    injectCompilerOptionsCheck(app)
  }

  const { mount } = app
  app.mount = (containerOrSelector: Element | ShadowRoot | string): any => {
    const container = normalizeContainer(containerOrSelector)
    if (!container) return

    const component = app._component
    if (!isFunction(component) && !component.render && !component.template) {
      // __UNSAFE__
      // Reason: potential execution of JS expressions in in-DOM template.
      // The user must make sure the in-DOM template is trusted. If it's
      // rendered by the server, the template should not contain any user data.
      // 翻译: 潜在的在 in-DOM 模板中执行 JS 表达式。
      //    用户必须确保 in-DOM 模板是受信任的。如果它是由服务器渲染的，那么模板不应该包含任何用户数据。

      component.template = container.innerHTML
      // 2.x compat check
      if (__COMPAT__ && __DEV__) {
        for (let i = 0; i < container.attributes.length; i++) {
          const attr = container.attributes[i]
          if (attr.name !== 'v-cloak' && /^(v-|:|@)/.test(attr.name)) {
            compatUtils.warnDeprecation(
              DeprecationTypes.GLOBAL_MOUNT_CONTAINER,
              null,
            )
            break
          }
        }
      }
    }

    // clear content before mounting
    container.innerHTML = ''
    const proxy = mount(container, false, resolveRootNamespace(container))
    if (container instanceof Element) {
      container.removeAttribute('v-cloak')
      container.setAttribute('data-v-app', '')
    }
    return proxy
  }

  return app
}) as CreateAppFunction<Element>

export const createSSRApp = ((...args) => {
  const app = ensureHydrationRenderer().createApp(...args)

  if (__DEV__) {
    injectNativeTagCheck(app)
    injectCompilerOptionsCheck(app)
  }

  const { mount } = app
  app.mount = (containerOrSelector: Element | ShadowRoot | string): any => {
    const container = normalizeContainer(containerOrSelector)
    if (container) {
      return mount(container, true, resolveRootNamespace(container))
    }
  }

  return app
}) as CreateAppFunction<Element>

function resolveRootNamespace(container: Element): ElementNamespace {
  if (container instanceof SVGElement) {
    return 'svg'
  }
  if (
    typeof MathMLElement === 'function' &&
    container instanceof MathMLElement
  ) {
    return 'mathml'
  }
}

//? 这个 injectNativeTagCheck 函数的目的是在 app.config 对象上注入一个 isNativeTag 属性。
//? 这个属性是一个函数，用于检查一个给定的标签名是否是一个原生的 HTML、SVG 或 MathML 标签。
//?
//? 这个函数使用了 Object.defineProperty 方法来定义 isNativeTag 属性。
//? 这个方法接收三个参数：要在其上定义属性的对象，要定义的属性的名称，以及一个描述符对象。
//? 描述符对象可以包含多个属性，用于配置属性的行为。
//?
//? 在这个例子中，描述符对象包含了 value 和 writable 两个属性。
//? value 属性是一个函数，接收一个字符串参数 tag，
//? 并检查它是否是一个 HTML、SVG 或 MathML 标签。
//? writable 属性被设置为 false，表示 isNativeTag 属性不能被重新赋值。
//?
//? 请注意，isHTMLTag、isSVGTag 和 isMathMLTag 函数的具体实现并未在这段代码中给出，
//? 但从函数名可以推测，它们可能是检查一个字符串是否是一个有效的 HTML、SVG 或 MathML 标签的函数。
function injectNativeTagCheck(app: App) {
  // Inject `isNativeTag`
  // this is used for component name validation (dev only)
  // 翻译: 注入 `isNativeTag`，这是用于组件名称验证的（仅在开发环境下）
  Object.defineProperty(app.config, 'isNativeTag', {
    value: (tag: string) => isHTMLTag(tag) || isSVGTag(tag) || isMathMLTag(tag),
    writable: false,
  })
}

//? 这个 injectCompilerOptionsCheck 函数的目的是在 app.config 对象上注入两个属性：isCustomElement 和 compilerOptions。
//? 这两个属性都被定义为 getter 和 setter，当它们被访问或修改时，会显示一些警告信息。
//?
//? 如果 isRuntimeOnly() 返回 true，则执行以下操作：
//? 保存 app.config.isCustomElement 的当前值到 isCustomElement 变量。
//?
//? 使用 Object.defineProperty 在 app.config 上定义一个 isCustomElement 属性。
//? 当这个属性被获取时，返回 isCustomElement 的值。
//? 当这个属性被设置时，显示一个警告信息，告诉用户 isCustomElement 配置选项已经被弃用，应该使用 compilerOptions.isCustomElement 代替。
//?
//? 保存 app.config.compilerOptions 的当前值到 compilerOptions 变量，并定义一个警告信息 msg。
//?
//? 使用 Object.defineProperty 在 app.config 上定义一个 compilerOptions 属性。
//? 当这个属性被获取或设置时，都会显示 msg 的警告信息。
//?
//! 这个函数的目的是在运行时检查配置选项，并在用户使用了不推荐或错误的配置选项时显示警告信息。
// dev only
function injectCompilerOptionsCheck(app: App) {
  if (isRuntimeOnly()) {
    const isCustomElement = app.config.isCustomElement
    Object.defineProperty(app.config, 'isCustomElement', {
      get() {
        return isCustomElement
      },
      set() {
        warn(
          `The \`isCustomElement\` config option is deprecated. Use ` +
            `\`compilerOptions.isCustomElement\` instead.`,
        )
      },
    })

    const compilerOptions = app.config.compilerOptions
    const msg =
      `The \`compilerOptions\` config option is only respected when using ` +
      `a build of Vue.js that includes the runtime compiler (aka "full build"). ` +
      `Since you are using the runtime-only build, \`compilerOptions\` ` +
      `must be passed to \`@vue/compiler-dom\` in the build setup instead.\n` +
      `- For vue-loader: pass it via vue-loader's \`compilerOptions\` loader option.\n` +
      `- For vue-cli: see https://cli.vuejs.org/guide/webpack.html#modifying-options-of-a-loader\n` +
      `- For vite: pass it via @vitejs/plugin-vue options. See https://github.com/vitejs/vite-plugin-vue/tree/main/packages/plugin-vue#example-for-passing-options-to-vuecompiler-sfc`

    Object.defineProperty(app.config, 'compilerOptions', {
      get() {
        warn(msg)
        return compilerOptions
      },
      set() {
        warn(msg)
      },
    })
  }
}
//? 这个 normalizeContainer 函数接收一个参数 container，
//? 这个参数可以是一个 Element、ShadowRoot 或者一个字符串。函数的返回值是一个 Element 或者 null。
//?
//? 如果 container 是一个字符串，那么它会被当作一个 CSS 选择器，
//? 函数会尝试使用 document.querySelector 方法在文档中查找与这个选择器匹配的元素。
//? 如果在开发环境中（__DEV__ 为 true）并且没有找到匹配的元素，那么会显示一个警告信息。
//? 最后，函数返回找到的元素或者 null。
//?
//? 如果 container 不是一个字符串，那么函数会检查它是否是一个 ShadowRoot 对象，
//? 并且它的 mode 属性是否为 'closed'。
//? 如果在开发环境中（__DEV__ 为 true）并且这两个条件都满足，那么会显示一个警告信息，
//? 因为在一个关闭模式的 ShadowRoot 上挂载应用可能会导致不可预测的错误。
//?
//? 最后，如果 container 不是一个字符串，并且它不是一个关闭模式的 ShadowRoot，那么函数直接返回 container。
//?
//? 这个函数的目的是将 container 参数标准化为一个 Element 对象，以便在后续的代码中使用。
//? 同时，它也会在开发环境中进行一些错误检查，以帮助开发者发现可能的问题。
function normalizeContainer(
  container: Element | ShadowRoot | string,
): Element | null {
  if (isString(container)) {
    const res = document.querySelector(container)
    if (__DEV__ && !res) {
      warn(
        `Failed to mount app: mount target selector "${container}" returned null.`,
      )
    }
    return res
  }
  if (
    __DEV__ &&
    window.ShadowRoot &&
    container instanceof window.ShadowRoot &&
    container.mode === 'closed'
  ) {
    warn(
      `mounting on a ShadowRoot with \`{mode: "closed"}\` may lead to unpredictable bugs`,
    )
  }
  return container as any
}

// Custom element support
export {
  defineCustomElement,
  defineSSRCustomElement,
  VueElement,
  type VueElementConstructor,
} from './apiCustomElement'

// SFC CSS utilities
export { useCssModule } from './helpers/useCssModule'
export { useCssVars } from './helpers/useCssVars'

// DOM-only components
export { Transition, type TransitionProps } from './components/Transition'
export {
  TransitionGroup,
  type TransitionGroupProps,
} from './components/TransitionGroup'

// **Internal** DOM-only runtime directive helpers
export {
  vModelText,
  vModelCheckbox,
  vModelRadio,
  vModelSelect,
  vModelDynamic,
} from './directives/vModel'
export { withModifiers, withKeys } from './directives/vOn'
export { vShow } from './directives/vShow'

import { initVModelForSSR } from './directives/vModel'
import { initVShowForSSR } from './directives/vShow'

let ssrDirectiveInitialized = false

/**
 * @internal
 */
export const initDirectivesForSSR = __SSR__
  ? () => {
      if (!ssrDirectiveInitialized) {
        ssrDirectiveInitialized = true
        initVModelForSSR()
        initVShowForSSR()
      }
    }
  : NOOP

// re-export everything from core
// h, Component, reactivity API, nextTick, flags & types
export * from '@vue/runtime-core'

export * from './jsx'
