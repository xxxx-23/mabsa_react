import {create} from 'zustand'
import { type AspectTerm, type BoundingBox, type MultimodalData } from '../types'

// 定义用户类型
export interface User {
    username: string,
    role: 'annotator' | 'reviewer'
}


// 后台静默同步函数
// 只要前端数据发生改变，就进行调用，悄悄把当前数据覆盖到数据库里
const syncToBackend = (data: MultimodalData) => {
    fetch("http://localhost:8000/api/data/save", {
        method:"POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify(data)
    }).catch(err=>console.error("🚨 数据库同步失败:",err))
}


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

    // 新增的身份认证中枢
    currentUser: User | null
    login: (username: string, role: User['role']) => void
    logout: () => void

    // 更新设置的方法
    updateSettings: (newSettings: Partial<DataStore["settings"]>) => void

    // 全新接口：从 Python 数据库加载全量大盘数据
    loadAllData: () => Promise<void>

    // 重写接口：在内存中纯粹地切换上一条/下一条
    fetchData: (index: number) => void

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

    // 删除方面词的方法
    deleteAspect: (tweetId: string, aspectId: string) => void

    // 删除当前正在展示的整条数据
    deleteCurrentData: () => void

    // 审核员专属的状态修改方法
    updateDataStatus: (tweetId: string, newStatus: 'pending' | 'done') => void
}

// 从本地硬盘（localStorage）“捞”数据
// const LOCAL_STORAGE_KEY = "MABSA_ANNOTATION_STATE"
// 我们抛弃了沉重的数据 localStorage，但保留了轻量级的“用户设置”
const savedSettings = JSON.parse(localStorage.getItem("MABSA_SETTINGS") || "null")


// 创建并导出一个 hook
// create<T>((set, get) => ({ ... })): 这是标准的创建方式。它接收一个函数，该函数返回状态对象。
// set：用于修改状态的方法
// get：用于需要在操作中读取当前状态（而不通过参数传入）
export const useDataState = create<DataStore>((set, get)=>({
    // 初始化时，把原来的假数据装进数据池
    dataList: [],
    currentData: null,
    currentIndex: 0,
    
    // isLoading 这种临时 UI 状态绝对不能缓存，永远初始化为 false 
    isLoading: false,

    // 初始化默认设置
    settings: savedSettings || {
        autoNext: false,
        showConfidence: false
    },

    // 尝试从本地缓存恢复登录状态
    currentUser: JSON.parse(localStorage.getItem("MABSA_USER") || "null"),

    login: (username, role) => {
        const user = {username, role}
        localStorage.setItem("MABSA_USER",JSON.stringify(user))
        set({currentUser: user})
    },

    logout: () => {
        localStorage.removeItem("MABSA_USER")
        set({currentUser:null})
    },
    
    // 1. 初始化：去数据库拉取全部数据
    loadAllData: async () => {
      set({ isLoading: true}) 
      try {
        const res = await fetch("http://localhost:8000/api/data/list")
        const json = await res.json()

        if(json.status === "success"){
            const list = json.data
            set({
                dataList: list,
                currentData: list.length > 0 ? list[0] :null,
                currentIndex: 0,
                isLoading: false
            })
        }
      } catch (error) {
        console.error("🚨 无法连接到数据库:",error)
        set({isLoading:false})
      } 
    },

    // 2. 分页切换：不再有假延迟，直接内存急速切换
    fetchData: async (index: number) => {
        const state = get()
        if(index >= 0 && index < state.dataList.length) {
            set({
                currentIndex: index,
                currentData: state.dataList[index]
            })
        }
    },

    // 3. 更新情感极性：乐观更新 UI，然后同步数据库
    updateAspectPolarity: (tweetId, aspectId, newPolarity) => {
        set((state) => {
            // 1. 安全检查：如果当前没数据，或者 ID 对不上，直接不做处理
            if(!state.currentData || state.currentData.tweetId !== tweetId){
                return state
            }

            // 2. 遍历当前的 aspects 数组，找到那个被点击的词，只修改它的极性，其他词原样保留
            const updatedAspects = state.currentData.aspects.map((aspect) => 
                aspect.id === aspectId ? {...aspect, polarity: newPolarity} : aspect
            )

            const updatedCurrentData = { ...state.currentData, aspects: updatedAspects}

            syncToBackend(updatedCurrentData)

            // 3. 返回一个全新的状态对象，替换掉旧的
            return {
                currentData: updatedCurrentData,
                dataList: state.dataList.map(data => data.tweetId === tweetId ? updatedCurrentData : data) 
            }
        })

    },

    deleteYoloBox: (tweetId, boxId) => {
            set((state) => {
                // 安全检查：如果当前没数据，或者操作的不是当前这条数据，直接返回
                if (!state.currentData || state.currentData.tweetId !== tweetId) return state;

                // 1. 过滤掉要删除的那个框
                const updatedBboxes = state.currentData.yoloBboxes.filter(b => b.id !== boxId);
                
                // 2. 组装最新的 currentData
                const updatedCurrentData = { ...state.currentData, yoloBboxes: updatedBboxes };

                syncToBackend(updatedCurrentData) // 同步入库

                // 3. 同时更新当前屏幕显示 (currentData) 和 历史总库 (dataList) ！！！
                return {
                    currentData: updatedCurrentData,
                    dataList: state.dataList.map(data => data.tweetId === tweetId ? updatedCurrentData : data)
                };
            });
    },
    
    deleteAspect: (tweetId, aspectId) => {
            set((state) => {
                if (!state.currentData || state.currentData.tweetId !== tweetId) return state;

                const updatedAspects = state.currentData.aspects.filter(a => a.id !== aspectId);
                const updatedCurrentData = { ...state.currentData, aspects: updatedAspects };

                syncToBackend(updatedCurrentData) // 同步入库

                return {
                    currentData: updatedCurrentData,
                    dataList: state.dataList.map(data => data.tweetId === tweetId ? updatedCurrentData : data)
                };
            });
    },

    // 实现导入外部数据的功能--添加新数据
    addNewData: (newData) => {

        // 直接同步给后端
        syncToBackend(newData)

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

            syncToBackend(updateCurrentData) // 同步入库

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

            syncToBackend(updatedCurrentData) // 同步入库

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
    },

    // 物理删除当前展示的数据
    deleteCurrentData: async () => {
        const state = get()
        if(state.dataList.length === 0 || !state.currentData) return

        const targetId = state.currentData.tweetId

        // 及其重要！！！
        // 先让后端删除！！如果后端删不掉，前端绝不能先动手，以保证数据一致性
        try {
            await fetch(`http://localhost:8000/api/data/delete/${targetId}`,{ method: "DELETE"})
        } catch (error) {
            console.error("🚨 彻底销毁数据失败:",error)
            return
        }

        // 后端成功后，更新前端页面
        set((state) => {
            const newList = [...state.dataList]
            newList.splice(state.currentIndex, 1)

            if(newList.length === 0){
                return {dataList: [], currentData: null, currentIndex: 0}
            }

            const newIndex = Math.min(state.currentIndex, newList.length - 1)
            return {
                dataList: newList,
                currentData: newList[newIndex],
                currentIndex:newIndex
            }
            
        })
    },

    // 审核员专属的数据状态修改方法(依旧使用乐观更新)
    updateDataStatus: (tweetId, newStatus) => {
        set((state) => {
            if(!state.currentData || state.currentData.tweetId !== tweetId) return state

            // 把状态改成 done 或 pending
            const updatedCurrentData = {...state.currentData,status: newStatus}

            syncToBackend(updatedCurrentData) // 马上把数据静默同步给 Python 数据库

            return {
                currentData: updatedCurrentData,
                dataList: state.dataList.map(data => data.tweetId === tweetId ? updatedCurrentData : data)
            }
        })
    }


}))

// 只保留偏好设置（如是否显示置信度）在 LocalStorage 里
useDataState.subscribe((state) => {
    try {
        localStorage.setItem("MABSA_SETTINGS",JSON.stringify(state.settings))
    } catch (error) {}
})