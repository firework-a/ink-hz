# 水墨杭州 WaterInk Hangzhou

**简体中文** | [English](./docs/README.en.md)

水墨风杭州城市 WebGL 网页。以程序化生成的城市（房屋、道路、树木）与自定义 GLSL shader 为基础，呈现水墨画风格的交互式三维杭州景观。

![首页预览](./docs/assets/homepage.png)

## 功能特性

- **WebGL 水墨渲染场景**：基于 Three.js 的场景实现（`src/features/WebglScene.tsx`），搭配多个自定义 GLSL shader（水面、ink 效果等，见 `src/features/shaders/`）
- **程序化城市数据**：房屋、道路、树木、奥体场馆等几何数据以 JSON 形式组织（`src/features/data/`）
- **诗词与标签系统**：场景中点缀杭州相关诗词（`poems.json`）与地标标签（`tags.json`）
- **BMFont 字体渲染**：支持 WebGL 内文字（`bmfont.ts`）与 DOM 文字（`bmfont-dom.ts`），使用行草字体（`font/xingcao-font.json`）

## 快速开始

环境要求：Node.js >= 24

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

然后打开 <http://localhost:3000> 查看效果。

## 构建与检查

```bash
# 生产构建
npm run build

# 代码检查 + 类型检查 + 构建（一步到位）
npm run check
```

## 项目结构

```
.
├── docs/                  # 文档与资源图片
│   ├── assets/
│   └── README.en.md       # 英文版 README
├── public/                # 静态资源
├── src/
│   ├── app/               # Next.js App Router（页面、布局、全局样式）
│   ├── features/          # 核心功能
│   │   ├── shaders/       # 自定义 GLSL shader
│   │   ├── data/          # 城市、诗词、标签等 JSON 数据
│   │   └── font/          # 行草字体（BMFont 格式）
│   └── types/             # 类型声明
├── next.config.ts
└── package.json
```

## 技术栈

- [Next.js](https://nextjs.org/) 16 · React 19
- [Three.js](https://threejs.org/) 0.186（WebGL 渲染）
- [Tailwind CSS](https://tailwindcss.com/) 4
- TypeScript 5 · ESLint 9
