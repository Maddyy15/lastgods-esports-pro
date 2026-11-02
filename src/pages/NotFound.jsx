import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { Button, EmptyState } from '@/components/ui/Primitives'

export default function NotFound() {
  return (
    <div className="py-16">
      <EmptyState
        icon={Compass}
        title="Page not found"
        message="That link does not exist. It may have been renamed, or the match you were looking for was deleted."
        action={
          <Link to="/">
            <Button>Back to dashboard</Button>
          </Link>
        }
      />
    </div>
  )
}
