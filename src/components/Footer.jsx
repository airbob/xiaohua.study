import { GRADES, gradeWordCount } from '../lib/levels.js'
import { useT, getLang } from '../lib/i18n.js'

const External = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1B1B26" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-label="open in new window" role="img">
    <path d="M14 4h6v6M20 4l-9 9" />
    <path d="M18 14v6H4V6h6" />
  </svg>
)

/** Site footer (designer's 页脚): word lists by grade, about, our other products, links. */
export default function Footer() {
  const t = useT()
  return (
    <footer className="site-foot">
      <section className="foot-lists">
        <div className="foot-wrap">
          <div className="foot-lists-head">
            <h2 className="display">{t('按年级看词语表')}</h2>
            <span>{t('每个词附拼音、英文意思和考卷例句')}</span>
          </div>
          <div className="foot-islands">
            {GRADES.map((g) => (
              <a key={g} className="foot-island" href={`/words/${g.toLowerCase()}/`}>
                <span className="display">{g}</span>
                <b>{t('华文听写词语表')}</b>
                <span>{t('{n} 词', { n: gradeWordCount(g) })}</span>
              </a>
            ))}
          </div>
        </div>
      </section>

      <div className="foot-wrap foot-main">
        <div className="foot-about">
          <div className="foot-brand">
            <span className="brand-logo big">写</span>
            <span className="display">{t('小华听写')}</span>
            <svg width="46" height="50" viewBox="0 0 120 130" aria-hidden="true">
              <path d="M60 6 C 52 26 20 56 20 84 a40 40 0 0 0 80 0 C 100 56 68 26 60 6 Z" fill="#8ED6D0" stroke="#1B1B26" strokeWidth="6" />
              <circle cx="45" cy="82" r="9" fill="#FFFFFF" />
              <circle cx="75" cy="82" r="9" fill="#FFFFFF" />
              <circle cx="47" cy="84" r="4.5" fill="#1B1B26" />
              <circle cx="77" cy="84" r="4.5" fill="#1B1B26" />
              <path d="M52 102 q8 7 16 0" stroke="#1B1B26" strokeWidth="4" fill="none" strokeLinecap="round" />
            </svg>
          </div>
          <p>{t('小华听写是给新加坡小学生的华文听写练习：听读音、看拼音，在田字格里把整个词写出来，写完逐个字检查笔画、笔顺和方向。词语整理自 P1–P6 华文考卷里最常出现的词。')}</p>
          {/* in English mode the paragraph above is already English */}
          {getLang() === 'zh' && (
            <p className="en" lang="en">
              Xiaohua (小华听写) is free Chinese tingxie (听写, spelling) practice for Singapore primary school students — handwrite each word and get stroke-by-stroke feedback.
            </p>
          )}
          <p className="credit">{t('英文释义来自 CC-CEDICT（CC BY-SA 4.0）')}</p>
        </div>

        <div className="foot-more">
          <div className="foot-kicker">{t('我们的其他作品')}</div>
          <a className="foot-card" href="https://sgexamhub.com" target="_blank" rel="noopener">
            <span className="foot-card-icon yellow">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#1B1B26" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M7 3h8l4 4v14H7z" fill="#FFFFFF" />
                <path d="M15 3v4h4" />
                <path d="M10 11h6M10 14h6M10 17h4" />
                <path d="M4 6v15h12" />
              </svg>
            </span>
            <span className="foot-card-text">
              <b>SGExamHub</b>
              <span>{t('新加坡小学考卷资源平台')}</span>
              <i>sgexamhub.com</i>
            </span>
            <External />
          </a>
          <a className="foot-card" href="https://dreamon.im/xiaohua" target="_blank" rel="noopener">
            <span className="foot-card-icon sea">
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="#1B1B26" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="6" y="2.5" width="12" height="19" rx="3" fill="#FFFFFF" />
                <path d="M10.5 18.5h3" />
                <path d="M9.5 8.5l2 2 3.5-4" />
              </svg>
            </span>
            <span className="foot-card-text">
              <b>{t('小华 App')}</b>
              <span>{t('拍照识字：扫一扫就有拼音、笔顺动画和练习')}</span>
              <i>dreamon.im/xiaohua</i>
            </span>
            <External />
          </a>
        </div>
      </div>

    </footer>
  )
}
