import {create} from 'zustand'
import { type AspectTerm, type BoundingBox, type MultimodalData } from '../types'
import { mockDataList } from '../utils/mockData'

// 定义这个 ‘仓库’ 里都有什么存货，以及能执行什么操作
interface DataStore {

    // 把整个列表存进仓库
    dataList: MultimodalData[]

    currentData: MultimodalData | null // 当前展示的数据
    currentIndex: number // 当前数据在数组中的索引值
    isLoading: boolean // 是否正在向后端请求数据？

    // 系统的全局设置偏好
    settings: {
        autoNext: boolean, // 标注完一个框后，是否自动跳转下一条？
        showConfidence: boolean // 是否显示 YOLO 框上的置信度
    }

    // 更新设置的方法
    updateSettings: (newSettings: Partial<DataStore["settings"]>) => void


    // 操作方法 (获取数据)
    fetchData: (index: number) => Promise<void> // 模拟请求后端接口

    // 定义修改情感极性的方法类型
    // 告诉仓库：我需要修改哪条推文、哪个词、改成什么极性
    updateAspectPolarity: (tweetId: string, aspectId: string, newPolarity: AspectTerm['polarity']) => void

    // 删除 YOLO 框的方法
    deleteYoloBox : (tweetId: string, boxId: string) => void

    // 接收外部传入的完整数据对象
    addNewData : (newData: MultimodalData) => void

    // 添加新的 aspect 的方法
    addAspect: (tweetId: string, newAspect: AspectTerm) => void

    // 添加新 YOLO 框的方法
    addYoloBox: (tweetId: string, newBox: BoundingBox) => void
}

// 从本地硬盘（localStorage）“捞”数据
const LOCAL_STORAGE_KEY = "MABSA_ANNOTATION_STATE"

const loadStateFromStorage = () => {
    try {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY)
        if(saved){
            return JSON.parse(saved)
        }
    } catch(error) {
        console.log("读取本地缓存失败，将使用默认数据：",error)
    }
    return null
}

// 在创建仓库前，先把本地数据提出来
const savedState = loadStateFromStorage()

// 1. 在 Zustand store 的外部（模块作用域内）准备一个变量，用来当“杀手”
// 如果是真实的 fetch 请求，这里会存一个 AbortController 实例
let currentTimer: ReturnType<typeof setTimeout> | null = null

// 创建并导出一个 hook
// create<T>((set, get) => ({ ... })): 这是标准的创建方式。它接收一个函数，该函数返回状态对象。
// set：用于修改状态的方法
// get：用于需要在操作中读取当前状态（而不通过参数传入）
export const useDataState = create<DataStore>((set, get)=>({
    // 初始化时，把原来的假数据装进数据池
    dataList: savedState?.dataList || [...mockDataList],
    currentData: savedState?.currentData || null,
    currentIndex: savedState?.currentIndex || 0,
    
    // isLoading 这种临时 UI 状态绝对不能缓存，永远初始化为 false 
    isLoading: false,

    // 初始化默认设置
    settings: savedState?.settings || {
        autoNext: false,
        showConfidence: false
    },
    

    // 一个异步函数，用来模拟真实的后端 API 请求
    fetchData: async (index: number) => {

        // 核心 Cleanup 逻辑：杀掉上一个还没执行完的请求！
        if(currentTimer) {
            clearTimeout(currentTimer) // 取消掉上一次的 setTimeout
            // 如果是真实的接口请求，这里会写: currentAbortController.abort()
        }

        // 1. 刚开始请求，把 isLoading 设为 true，告诉页面要转圈圈了
        set({ isLoading: true})

        // 2. 模拟网络延迟
        // 把这一次的定时器 ID 存起来，方便下次如果又被频繁点击时，能把它杀掉
        await new Promise((resolve) => {currentTimer = setTimeout(resolve, 800)})

        // 3. 从假数据库里取出对应的数据
        // const data = mockDataList[index]
        // 修改为：从仓库自己的 dataList 里拿数据，而不是去读外部的 mockDataList
        const state = get()

        // 数据拿到了，更新仓库，并把 isLoading 设回 false 
        set({
            currentData: state.dataList[index],
            currentIndex: index,
            isLoading: false
        })

        // 执行完后，把“杀手”变量清空
        currentTimer = null
    },

    // 实现修改逻辑（深层嵌套对象更新）
    updateAspectPolarity: (tweetId, aspectId, newPolarity) => {
        set((state) => {
            // 1. 安全检查：如果当前没数据，或者 ID 对不上，直接不做处理
            if(!state.currentData || state.currentData.tweetId !== tweetId){
                return state
            }

            // 2. 遍历当前的 aspects 数组，找到那个被点击的词，只修改它的极性，其他词原样保留
            const updatedAspects = state.currentData.aspects.map((aspect) => {
                if(aspect.id === aspectId){
                    // 找到了对应的 aspect，用 ... 复制它的旧属性，然后用 newPolarity 覆盖旧的 polarity
                    return {...aspect, polarity: newPolarity}
                }
                // 没找到的词，直接原样返回
                return aspect
            })

            // 3. 返回一个全新的状态对象，替换掉旧的
            return {
                currentData: {
                    ...state.currentData,
                    aspects: updatedAspects
                }
            }
        })

    },

    // 实现删除 YOLO 边框的逻辑
    deleteYoloBox: (tweetId, boxId) => {
        set((state) => {
            // 安全检查 如果当前没数据，或者 ID 对不上，直接不做处理
            if(!state.currentData || state.currentData.tweetId !== tweetId){
                return state
            }

            // console.log('准备删除的 boxId是:',boxId)

            // 用 filter 过滤掉我们要删掉的 boxId
            // 只要框的 Id 不等于我们要删除的 boxId，就进行保留
            const updateBboxes = state.currentData.yoloBboxes.filter((box) => 
                box.id !== boxId
            )

            // console.log("过滤后的数组是:", updateBboxes)

            // 返回新的状态替换旧的状态
            return {
                currentData: {
                    ...state.currentData,
                    yoloBboxes: updateBboxes
                }
            }


        })
    },

    // 实现导入外部数据的功能--添加新数据
    addNewData: (newData) => {
        set((state) => {
            // 1. 把新数据追加到列表的末尾
            const newList = [...state.dataList,newData]
            const newIndex = newList.length - 1 // 新数据的索引就是最后一个
            
            return {
                dataList: newList,
                currentData: newData,
                currentIndex: newIndex
            }

        })
    },

    // 添加新的 Aspect 的逻辑
    addAspect: (tweetId, newAspect) => {
        set((state) => {
            // 安全检查
            if(!state.currentData || state.currentData.tweetId !== tweetId) return state

            // 把新的 aspect 追加到当前的 aspects 数组中
            const updatedAspects = [...state.currentData.aspects, newAspect]

            const updateCurrentData = {
                ...state.currentData,
                aspects: updatedAspects
            }

            // 返回新的状态（注意：为了保持同步，我们最好把 dataList 里的那条数据也更新了）
            return {
                currentData: updateCurrentData,
                dataList: state.dataList.map((data)=>
                    data.tweetId === tweetId ? updateCurrentData : data
                )
            }

        })
    },

    // 添加新的 YOLO 边框的逻辑
    addYoloBox: (tweetId, newBox) => {
        set((state) => {
            if(!state.currentData || state.currentData.tweetId !== tweetId){
                return state
            }

            // 把新框追加给当前数据的 yoloBboxes 数组中
            const updatedBboxes = [...state.currentData.yoloBboxes, newBox]

            const updatedCurrentData = {
                ...state.currentData,
                yoloBboxes: updatedBboxes
            }

            return {
                currentData:updatedCurrentData,
                // 同步更新数据大盘（如果有用 dataList的话）
                dataList: state.dataList.map(data => data.tweetId === tweetId ? updatedCurrentData : data)
            }
        })
    },

    // 合并更新设置的方法
    updateSettings: (newSettings) => {
        set((state) => ({
            settings: {...state.settings, ...newSettings}
        }))
    }

}))

// 监听仓库变化，自动存入 localStorage
// Zustand 的 subscribe 订阅机制
useDataState.subscribe((state) => {
    try {
        // 每次状态改变，我们就把最新的数据组装成一个对象
        // 注意：刻意排除了 isLoading，并且用 try-catch 包裹防止浏览器隐私模式下报错
        const stateToSave = {
            dataList: state.dataList,
            currentIndex: state.currentIndex,
            currentData: state.currentData,
            settings: state.settings
        }
        // 序列化并存入浏览器硬盘
        localStorage.setItem(LOCAL_STORAGE_KEY,JSON.stringify(stateToSave))
    } catch (error) {
        console.error("持久化数据到本地失败：",error);
    }
})