/**
 * Make a map and return a function for checking if a key
 * is in that map.
 * IMPORTANT: all calls of this function must be prefixed with
 * \/\*#\_\_PURE\_\_\*\/
 * So that rollup can tree-shake them if necessary.
 */

//? 这个 makeMap 函数接收两个参数：一个字符串 str 和一个可选的布尔值 expectsLowerCase。
//? 它返回一个新的函数，这个函数接收一个字符串参数 key，并检查这个 key 是否在原始的 str 中。
//?
//? 首先，makeMap 函数使用 str.split(',') 将原始的字符串 str 分割为一个数组，然后使用 new Set() 将这个数组转换为一个 Set 对象。
//? Set 对象是一种特殊的数据结构，它只存储唯一的值，所以这个 set 只包含 str 中的唯一标签。
//?
//? 然后，makeMap 函数返回一个新的函数。这个函数接收一个字符串参数 val，并检查这个 val 是否在 set 中。
//? 如果 expectsLowerCase 是 true，那么这个函数会将 val 转换为小写后再进行检查。
//?
//? 所以，isHTMLTag、isSVGTag 和 isMathMLTag 函数实际上是检查一个给定的标签名是否在一个预定义的标签集合中。
//? 如果在，那么返回 true，否则返回 false。

/*! #__NO_SIDE_EFFECTS__ */
export function makeMap(
  str: string,
  expectsLowerCase?: boolean,
): (key: string) => boolean {
  const set = new Set(str.split(','))
  return expectsLowerCase
    ? val => set.has(val.toLowerCase())
    : val => set.has(val)
}
