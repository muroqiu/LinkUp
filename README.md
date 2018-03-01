## cocos creator 连连看

 by 慕容秋 muroqiu@qq.com
 2018-02-25
  
### 主要的逻辑：
A、洗牌 shuffle：遍历图片数组，取1个随机位置的图片和当前位置交换；

B、用一个二维数组（各个方向均比图片数组大1）保存图片的状态值，搜索路径时映射到这个数组搜索；

C、搜索顺序：
  * 1、同一条直线：判断直线间有无图片；
  * 2、有一个拐角：先定位出两个拐角点，若拐角点没有图片，再转换成一条直线的情况继续处理；
  * 3、两个拐角：某个方向移动，若到达点没有图片，再转换成一个拐角的情况继续处理；若到达点有图片，此方向不再继续搜索；

源码地址: [https://gitee.com/muroqiu/LinkUp](https://gitee.com/muroqiu/LinkUp)

演示效果：[http://link.muroqiu.com](http://link.muroqiu.com)