export default function NotFound({ navigate }) {
  return (
    <div className="not-found">
      <h1>404</h1>
      <p>页面不存在。</p>
      <button className="btn btn-primary" onClick={() => navigate('/')}>返回首页</button>
    </div>
  )
}
