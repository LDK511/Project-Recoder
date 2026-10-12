import React from 'react';
import { Link } from 'react-router-dom';
import { EmptyState } from '../components/ui';

const NotFoundPage: React.FC = () => (
  <div className="shell pt-10">
    <EmptyState
      icon="search"
      title="찾는 페이지가 없어요"
      description="주소가 바뀌었거나 삭제된 페이지입니다."
      action={
        <Link to="/" className="btn-primary">
          홈으로
        </Link>
      }
    />
  </div>
);

export default NotFoundPage;
