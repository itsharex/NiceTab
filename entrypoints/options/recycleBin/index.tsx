import { useState, useEffect, useCallback } from 'react';
import { theme, Collapse, Space, Button, Modal, Empty, Alert } from 'antd';
import { useIntlUtls } from '~/entrypoints/common/hooks/global';
import useUrlParams from '~/entrypoints/common/hooks/urlParams';
import { TagItem, GroupItem, TabItem } from '~/entrypoints/types';
import { recycleUtils, initRecycleStorageListener } from '~/entrypoints/common/storage';
import { updateAdminPageUrlDebounced } from '~/entrypoints/common/tabs';
import { StyledEmptyBox, StyledRecycleBinWrapper } from './index.styled';
import { StickyBox } from '~/entrypoints/common/components/StickyBox';
import TagNodeMarkup from './TagNode';
import TabGroup from '../home/TabGroupRecycle';

export default function RecycleBin() {
  const { token } = theme.useToken();
  const { $fmt } = useIntlUtls();
  const [tagList, setTagList] = useState<TagItem[]>([]);
  const [activeKey, setActiveKey] = useState<string | string[]>([]);
  const [recoverModalVisible, setRecoverModalVisible] = useState<boolean>(false);
  const [confirmModalVisible, setConfirmModalVisible] = useState<boolean>(false);

  // 获取回收站数据
  const getRecycleBinData = useCallback(async () => {
    const recycleList = await recycleUtils.getTagList();
    setTagList(recycleList || []);
    // setActiveKey(recycleList.map((tag) => tag.tagId) || []); // 默认全部展开
  }, []);

  // 删除标签组
  const handleTabGroupRemove = useCallback(
    async (tag: TagItem, group: GroupItem) => {
      if (!tag?.tagId || !group?.groupId) return;
      await recycleUtils.removeTabGroup(tag.tagId, group.groupId);
      getRecycleBinData();
    },
    [getRecycleBinData]
  );

  // 恢复标签组 (从回收站恢复到列表页)
  const handleTabGroupRecover = useCallback(
    async (tag: TagItem, group: GroupItem) => {
      await recycleUtils.recoverTabGroups(tag, [group]);
      getRecycleBinData();
    },
    [getRecycleBinData]
  );
  // 删除标签页
  const handleTabItemRemove = useCallback(
    async (groupId: React.Key, tabs: TabItem[]) => {
      await recycleUtils.removeTabs(groupId, tabs, true);
      getRecycleBinData();
    },
    [getRecycleBinData]
  );
  // 修改标签页
  const handleTabItemChange = useCallback(
    async (tag: TagItem, group: GroupItem, tabData: TabItem) => {
      await recycleUtils.updateTab({
        tagId: tag.tagId,
        groupId: group.groupId,
        data: tabData,
      });
      getRecycleBinData();
    },
    [getRecycleBinData]
  );

  /* 顶部按钮事件 */
  // 展开全部、收起全部
  // const toggleExpand = useCallback(
  //   (bool: boolean) => {
  //     if (bool) {
  //       setActiveKey(tagList.map((tag) => tag.tagId) || []);
  //     } else {
  //       setActiveKey([]);
  //     }
  //   },
  //   [tagList]
  // );
  // 还原所有
  const handleRecoverConfirm = useCallback(async () => {
    await recycleUtils.recoverAll();
    setRecoverModalVisible(false);
    getRecycleBinData();
  }, []);
  // 清空回收站
  const handleClearConfirm = useCallback(async () => {
    await recycleUtils.setTagList([]);
    setConfirmModalVisible(false);
    getRecycleBinData();
  }, []);

  const { urlParams } = useUrlParams();

  useEffect(() => {
    getRecycleBinData();
  }, [urlParams]);

  useEffect(() => {
    getRecycleBinData();
    return initRecycleStorageListener(async (tabList) => {
      const currWindow = await browser.windows.getCurrent();
      if (!currWindow.focused) {
        updateAdminPageUrlDebounced();
      }
    });
  }, []);

  return (
    <StyledRecycleBinWrapper className="recycle-bin-wrapper">
      <StickyBox topGap={60} fullWidth bgColor={token.colorBgContainer}>
        <Space className="header-action-btns">
          {/*
          <Button type="primary" size="small" onClick={() => toggleExpand(true)}>
            {$fmt('home.expandAll')}
          </Button>
          <Button type="primary" size="small" onClick={() => toggleExpand(false)}>
            {$fmt('home.collapseAll')}
          </Button>
          */}
          <Button type="primary" onClick={() => setRecoverModalVisible(true)}>
            {$fmt('home.recoverAll')}
          </Button>
          <Button type="primary" onClick={() => setConfirmModalVisible(true)}>
            {$fmt('home.clearAll')}
          </Button>
          <Alert
            className="warning-tip"
            type="warning"
            showIcon
            message={$fmt('recycleBin.tip.autoClear')}
          />
        </Space>
      </StickyBox>

      {tagList?.length > 0 ? (
        <Collapse
          bordered={false}
          size="large"
          ghost
          activeKey={activeKey}
          onChange={setActiveKey}
          items={tagList.map((tag) => {
            return {
              key: tag.tagId,
              label: (
                <TagNodeMarkup
                  tag={tag}
                  onRemove={getRecycleBinData}
                  onRecover={getRecycleBinData}
                />
              ),
              style: {
                marginBottom: 16,
                background: token.colorFillContent,
                borderRadius: token.borderRadiusLG,
                border: 'none',
              },
              children: (
                <div className="tab-group-list">
                  {tag.groupList.map((group) => (
                    <TabGroup
                      key={group.groupId}
                      {...group}
                      canDrag={false}
                      canDrop={false}
                      allowGroupActions={['remove', 'recover']}
                      allowTabActions={['remove', 'recover']}
                      onRemove={() => handleTabGroupRemove(tag, group)}
                      onRecover={() => handleTabGroupRecover(tag, group)}
                      onTabChange={(tabItem: TabItem) =>
                        handleTabItemChange(tag, group, tabItem)
                      }
                      onTabRemove={handleTabItemRemove}
                    ></TabGroup>
                  ))}
                </div>
              ),
            };
          })}
        />
      ) : (
        <StyledEmptyBox className="no-data">
          <Empty description={$fmt('home.emptyTip')}></Empty>
        </StyledEmptyBox>
      )}

      {/* 清空全部提示 */}
      <Modal
        title={$fmt('home.recoverTitle')}
        width={400}
        open={recoverModalVisible}
        onOk={handleRecoverConfirm}
        onCancel={() => setRecoverModalVisible(false)}
      >
        <div>{$fmt('home.recoverAllDesc')}</div>
      </Modal>
      {/* 清空全部提示 */}
      <Modal
        title={$fmt('home.clearTitle')}
        width={400}
        open={confirmModalVisible}
        onOk={handleClearConfirm}
        onCancel={() => setConfirmModalVisible(false)}
      >
        <div>{$fmt('home.clearDesc')}</div>
      </Modal>
    </StyledRecycleBinWrapper>
  );
}
