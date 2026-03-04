// 首先引入我们在 types/index.ts 中定义好的类型
import { type MultimodalData } from '../types'
import localImage from '../assets/1739565.jpg'


// 声明一个变量 mockData ， 并告诉 TypeScript 它的类型是 MultimodalData
export const mockDataList: MultimodalData[] = [
    {
    tweetId: '001',
    rawText: 'Crazy hair day ! Lydia is a contender . : )',
    imageUrl: 'https://picsum.photos/600/400?random=1',
    aspects: [{
        id: 'a1',
        term: 'Lydia',
        startIndex: 17,
        endIndex: 22,
        polarity: 'positive'
    },{
        id: 'a2',
        term: 'hair',
        startIndex: 6,
        endIndex: 10,
        polarity: 'neutral'
    }],
    yoloBboxes: [{
       id: 'box1',
       label: 'person',
       confidence: 0.90,
       x: 45,
       y: 80,
       width: 200,
       height: 300
    },
    {
       id: 'box2',
       label: 'scarf',
       confidence: 0.90,
       x: 70,
       y: 210,
       width: 130,
       height: 170
    },
    {
       id: 'box3',
       label: 'cup',
       confidence: 0.85,
       x: 100,
       y: 150,
       width: 120,
       height: 150
    }]
    },
    {
        tweetId: '002',
        rawText: 'The new camera on this phone is terrible, but the battery life is great.',
        imageUrl: 'https://picsum.photos/600/400?random=2', // 用一张网图占位
        aspects: [
            {
                id: 'a1',
                term: 'camera',
                startIndex: 8,
                endIndex: 14,
                polarity: 'negative',
            },
            { 
                id: 'a2', 
                term: 'battery life', 
                startIndex: 50, 
                endIndex: 62, 
                polarity: 'positive' }
        ],
        yoloBboxes: [
            {
                id: 'box1',
                label: 'cell phone',
                confidence: 0.98,
                x: 100, 
                y: 100, 
                width: 150, 
                height: 250
            }
        ]
    }
 ]
